import { defaultTransport } from "./core/transport.js";
import type { HttpTransport } from "./core/transport.js";
import { SemaphoreConfigError } from "./errors.js";

export interface SemaphoreClientOptions {
  apiKey: string;
  defaultSender?: string;
  timeoutMs?: number;
  transport?: HttpTransport;
}

export interface ResolvedClientConfig {
  readonly apiKey: string;
  readonly defaultSender: string | undefined;
  readonly timeoutMs: number;
  readonly transport: HttpTransport;
}

export function resolveClientConfig(
  options: SemaphoreClientOptions,
): ResolvedClientConfig {
  if (
    typeof options !== "object" ||
    options === null ||
    Array.isArray(options)
  ) {
    throw new SemaphoreConfigError("Client options must be an object.");
  }

  const { apiKey, defaultSender, timeoutMs, transport } = options;

  if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
    throw new SemaphoreConfigError("apiKey must be a nonblank string.");
  }

  if (
    defaultSender !== undefined &&
    (typeof defaultSender !== "string" || defaultSender.trim().length === 0)
  ) {
    throw new SemaphoreConfigError("defaultSender must be a nonblank string.");
  }

  if (
    timeoutMs !== undefined &&
    (typeof timeoutMs !== "number" ||
      !Number.isFinite(timeoutMs) ||
      timeoutMs <= 0)
  ) {
    throw new SemaphoreConfigError(
      "timeoutMs must be a positive, finite number.",
    );
  }

  if (transport !== undefined && typeof transport !== "function") {
    throw new SemaphoreConfigError("transport must be a function.");
  }

  return Object.freeze({
    apiKey,
    defaultSender,
    timeoutMs: timeoutMs === undefined ? 10_000 : timeoutMs,
    transport: transport === undefined ? defaultTransport : transport,
  });
}
