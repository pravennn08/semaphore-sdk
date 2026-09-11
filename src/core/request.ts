import type { ResolvedClientConfig } from "../config.js";
import { SemaphoreApiError, SemaphoreValidationError } from "../errors.js";

const API_BASE_URL = "https://api.semaphore.co/api/v4";

export interface RequestOptions {
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
}

export interface RateLimitMetadata {
  readonly limit: number | null;
  readonly remaining: number | null;
  readonly retryAfterSeconds: number | null;
}

export interface RequestMetadata {
  readonly statusCode: number;
  readonly rateLimit: RateLimitMetadata;
}

export interface ApiResponse<T> {
  readonly data: T;
  readonly meta: RequestMetadata;
}

export interface RequestOperation<T> {
  readonly path: string;
  readonly method?: "GET" | "POST";
  readonly query?: Readonly<Record<string, string>>;
  readonly form?: Readonly<Record<string, string>>;
  readonly parse: (payload: unknown) => T;
}

export type RequestExecutor = <T>(
  operation: RequestOperation<T>,
  options?: RequestOptions,
) => Promise<ApiResponse<T>>;

function parseNumberHeader(value: string | null): number | null {
  if (value === null || value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseRetryAfter(value: string | null): number | null {
  if (value === null || value.trim() === "") {
    return null;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds;
  }

  const date = Date.parse(value);
  if (Number.isNaN(date)) {
    return null;
  }

  return Math.max(0, (date - Date.now()) / 1_000);
}

function rateLimitMetadata(response: Response): RateLimitMetadata {
  return {
    limit: parseNumberHeader(response.headers.get("x-ratelimit-limit")),
    remaining: parseNumberHeader(response.headers.get("x-ratelimit-remaining")),
    retryAfterSeconds: parseRetryAfter(response.headers.get("retry-after")),
  };
}

function validateTimeout(
  timeoutMs: number | undefined,
  fallback: number,
): number {
  if (
    timeoutMs !== undefined &&
    (typeof timeoutMs !== "number" ||
      !Number.isFinite(timeoutMs) ||
      timeoutMs <= 0)
  ) {
    throw new SemaphoreValidationError(
      "timeoutMs must be a positive, finite number.",
    );
  }

  return timeoutMs ?? fallback;
}

function validateRequestOptions(options: RequestOptions): void {
  if (
    typeof options !== "object" ||
    options === null ||
    Array.isArray(options)
  ) {
    throw new SemaphoreValidationError("Request options must be an object.");
  }
}

function isKnownProviderRejection(statusCode: number): boolean {
  return [400, 401, 403, 404, 405, 413, 415, 422, 429].includes(statusCode);
}

function abortError(
  kind: "timeout" | "cancelled",
  submission: "not_sent" | "unknown",
): SemaphoreApiError {
  return new SemaphoreApiError(
    kind === "timeout"
      ? "Semaphore request timed out."
      : "Semaphore request was cancelled.",
    { kind, submission },
  );
}

export function createRequestExecutor(
  config: ResolvedClientConfig,
): RequestExecutor {
  return async <T>(
    operation: RequestOperation<T>,
    options: RequestOptions = {},
  ) => {
    validateRequestOptions(options);
    const timeoutMs = validateTimeout(options.timeoutMs, config.timeoutMs);

    if (options.signal?.aborted) {
      throw abortError("cancelled", "not_sent");
    }

    const controller = new AbortController();
    let timedOut = false;
    let callerCancelled = false;
    let rejectControl: ((reason?: unknown) => void) | undefined;
    const controlPromise = new Promise<never>((_, reject) => {
      rejectControl = reject;
    });

    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      rejectControl?.(Symbol.for("semaphore.timeout"));
    }, timeoutMs);

    const onCallerAbort = () => {
      callerCancelled = true;
      controller.abort();
      rejectControl?.(Symbol.for("semaphore.cancelled"));
    };

    options.signal?.addEventListener("abort", onCallerAbort, { once: true });
    try {
      if (options.signal?.aborted) {
        throw abortError("cancelled", "not_sent");
      }

      const method = operation.method ?? "POST";
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(operation.query ?? {})) {
        if (key !== "apikey") {
          query.set(key, value);
        }
      }
      const requestUrl = `${API_BASE_URL}/${operation.path}`;
      const requestInit: RequestInit = {
        method,
        headers: {
          accept: "application/json",
        },
        redirect: "error",
        signal: controller.signal,
      };

      if (method === "GET") {
        query.set("apikey", config.apiKey);
      } else {
        const form = new URLSearchParams();
        for (const [key, value] of Object.entries(operation.form ?? {})) {
          if (key !== "apikey") {
            form.set(key, value);
          }
        }
        form.set("apikey", config.apiKey);
        requestInit.headers = {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded",
        };
        requestInit.body = form;
      }

      const operationPromise = (async () => {
        const response = await config.transport(
          query.size > 0 ? `${requestUrl}?${query}` : requestUrl,
          requestInit,
        );
        const rawBody = await response.text();
        return { response, rawBody };
      })();

      let response: Response;
      let rawBody: string;
      try {
        ({ response, rawBody } = await Promise.race([
          operationPromise,
          controlPromise,
        ]));
      } catch (cause) {
        if (cause === Symbol.for("semaphore.timeout") || timedOut) {
          throw abortError("timeout", "unknown");
        }
        if (cause === Symbol.for("semaphore.cancelled") || callerCancelled) {
          throw abortError("cancelled", "unknown");
        }

        throw new SemaphoreApiError("Unable to connect to Semaphore.", {
          kind: "transport",
          submission: "unknown",
        });
      }

      const rateLimit = rateLimitMetadata(response);
      if (!response.ok) {
        throw new SemaphoreApiError("Semaphore rejected the request.", {
          kind: "http",
          submission: isKnownProviderRejection(response.status)
            ? "rejected"
            : "unknown",
          statusCode: response.status,
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        });
      }

      let payload: unknown;
      try {
        payload = JSON.parse(rawBody) as unknown;
      } catch {
        throw new SemaphoreApiError("Semaphore returned an invalid response.", {
          kind: "invalid_response",
          submission: "unknown",
          statusCode: response.status,
        });
      }

      let data: T;
      try {
        data = operation.parse(payload);
      } catch {
        throw new SemaphoreApiError("Semaphore returned an invalid response.", {
          kind: "invalid_response",
          submission: "unknown",
          statusCode: response.status,
        });
      }

      return {
        data,
        meta: { statusCode: response.status, rateLimit },
      };
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onCallerAbort);
    }
  };
}
