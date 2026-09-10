import { describe, expect, it, vi } from "vitest";
import { resolveClientConfig } from "../../src/config.js";
import { createRequestExecutor } from "../../src/core/request.js";
import type { HttpTransport } from "../../src/core/transport.js";
import {
  SemaphoreApiError,
  SemaphoreValidationError,
} from "../../src/errors.js";

const operation = {
  path: "messages",
  form: { number: "639171234567", message: "Hello" },
  parse: (payload: unknown) => payload,
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "x-ratelimit-limit": "120",
      "x-ratelimit-remaining": "118",
      "retry-after": "2",
    },
  });
}

describe("request executor", () => {
  it("adds authentication, preserves metadata, and parses the response", async () => {
    const transport = vi
      .fn<HttpTransport>()
      .mockResolvedValue(jsonResponse({ ok: true }));
    const request = createRequestExecutor(
      resolveClientConfig({ apiKey: "test-api-key", transport }),
    );

    const result = await request(operation);
    const form = transport.mock.calls[0][1]?.body as URLSearchParams;

    expect(form.get("apikey")).toBe("test-api-key");
    expect(form.get("number")).toBe("639171234567");
    expect(result).toEqual({
      data: { ok: true },
      meta: {
        statusCode: 200,
        rateLimit: {
          limit: 120,
          remaining: 118,
          retryAfterSeconds: 2,
        },
      },
    });
  });

  it("classifies known provider rejections without exposing the body", async () => {
    const transport = vi
      .fn<HttpTransport>()
      .mockResolvedValue(
        new Response("secret phone and message", { status: 422 }),
      );
    const request = createRequestExecutor(
      resolveClientConfig({ apiKey: "secret-api-key", transport }),
    );

    const error = await request(operation).catch((value: unknown) => value);

    expect(error).toBeInstanceOf(SemaphoreApiError);
    expect(error).toMatchObject({
      kind: "http",
      submission: "rejected",
      statusCode: 422,
    });
    expect(String(error)).not.toContain("secret phone");
    expect(String(error)).not.toContain("secret-api-key");
  });

  it("treats server failures as uncertain and never retries", async () => {
    const transport = vi
      .fn<HttpTransport>()
      .mockResolvedValue(new Response("server error", { status: 503 }));
    const request = createRequestExecutor(
      resolveClientConfig({ apiKey: "test-api-key", transport }),
    );

    await expect(request(operation)).rejects.toMatchObject({
      kind: "http",
      submission: "unknown",
      statusCode: 503,
    });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("classifies invalid JSON and parser failures as uncertain", async () => {
    const invalidJsonTransport = vi
      .fn<HttpTransport>()
      .mockResolvedValue(new Response("<html>error</html>", { status: 200 }));
    const invalidJsonRequest = createRequestExecutor(
      resolveClientConfig({
        apiKey: "test-api-key",
        transport: invalidJsonTransport,
      }),
    );

    await expect(invalidJsonRequest(operation)).rejects.toMatchObject({
      kind: "invalid_response",
      submission: "unknown",
      statusCode: 200,
    });

    const parserTransport = vi
      .fn<HttpTransport>()
      .mockResolvedValue(jsonResponse({ ok: true }));
    const parserRequest = createRequestExecutor(
      resolveClientConfig({
        apiKey: "test-api-key",
        transport: parserTransport,
      }),
    );

    await expect(
      parserRequest({
        ...operation,
        parse: () => {
          throw new Error("secret");
        },
      }),
    ).rejects.toMatchObject({
      kind: "invalid_response",
      submission: "unknown",
    });
  });

  it("classifies body read failures as uncertain", async () => {
    const transport = vi.fn<HttpTransport>().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: () => Promise.reject(new Error("body failure")),
    } as Response);
    const request = createRequestExecutor(
      resolveClientConfig({ apiKey: "test-api-key", transport }),
    );

    await expect(request(operation)).rejects.toMatchObject({
      kind: "transport",
      submission: "unknown",
    });
  });

  it("honors the configured timeout even if a transport ignores abort", async () => {
    const transport = vi.fn<HttpTransport>(
      () => new Promise<Response>(() => undefined),
    );
    const request = createRequestExecutor(
      resolveClientConfig({ apiKey: "test-api-key", timeoutMs: 10, transport }),
    );

    await expect(request(operation)).rejects.toMatchObject({
      kind: "timeout",
      submission: "unknown",
    });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("honors caller cancellation even if a transport ignores abort", async () => {
    const transport = vi.fn<HttpTransport>(
      () => new Promise<Response>(() => undefined),
    );
    const request = createRequestExecutor(
      resolveClientConfig({ apiKey: "test-api-key", transport }),
    );
    const controller = new AbortController();
    const pending = request(operation, {
      signal: controller.signal,
      timeoutMs: 1_000,
    });
    setTimeout(() => controller.abort(), 10);

    await expect(pending).rejects.toMatchObject({
      kind: "cancelled",
      submission: "unknown",
    });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("does not dispatch when already cancelled", async () => {
    const transport = vi.fn<HttpTransport>();
    const request = createRequestExecutor(
      resolveClientConfig({ apiKey: "test-api-key", transport }),
    );
    const controller = new AbortController();
    controller.abort();

    await expect(
      request(operation, { signal: controller.signal }),
    ).rejects.toMatchObject({
      kind: "cancelled",
      submission: "not_sent",
    });
    expect(transport).not.toHaveBeenCalled();
  });

  it("rejects invalid request timeout before dispatch", async () => {
    const transport = vi.fn<HttpTransport>();
    const request = createRequestExecutor(
      resolveClientConfig({ apiKey: "test-api-key", transport }),
    );

    await expect(request(operation, { timeoutMs: 0 })).rejects.toBeInstanceOf(
      SemaphoreValidationError,
    );
    expect(transport).not.toHaveBeenCalled();
  });

  it("rejects malformed request options before dispatch", async () => {
    const transport = vi.fn<HttpTransport>();
    const request = createRequestExecutor(
      resolveClientConfig({ apiKey: "test-api-key", transport }),
    );

    await expect(
      request(operation, null as unknown as { timeoutMs?: number }),
    ).rejects.toBeInstanceOf(SemaphoreValidationError);
    expect(transport).not.toHaveBeenCalled();
  });
});
