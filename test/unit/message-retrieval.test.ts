import { describe, expect, it, vi } from "vitest";
import { SemaphoreClient } from "../../src/client.js";
import { SemaphoreValidationError } from "../../src/errors.js";
import type { HttpTransport } from "../../src/core/transport.js";

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
      "x-ratelimit-limit": "30",
      "x-ratelimit-remaining": "29",
    },
  });
}

describe("message retrieval", () => {
  it("lists messages with validated filters over GET", async () => {
    const transport = vi.fn<HttpTransport>().mockResolvedValue(
      response([
        {
          message_id: "retrieved-1",
          recipient: "639171234567",
          sender_name: "Alerts",
          status: "Success",
        },
      ]),
    );
    const client = new SemaphoreClient({
      apiKey: "test-api-key",
      transport,
    });

    const result = await client.messages.list({
      page: 2,
      limit: 100,
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      network: " Globe ",
      status: " SUCCESS ",
    });

    const [url, init] = transport.mock.calls[0];
    const parsedUrl = new URL(String(url));
    expect(parsedUrl.pathname).toBe("/api/v4/messages");
    expect(parsedUrl.searchParams.get("apikey")).toBe("test-api-key");
    expect(parsedUrl.searchParams.get("page")).toBe("2");
    expect(parsedUrl.searchParams.get("limit")).toBe("100");
    expect(parsedUrl.searchParams.get("startDate")).toBe("2026-01-01");
    expect(parsedUrl.searchParams.get("endDate")).toBe("2026-01-31");
    expect(parsedUrl.searchParams.get("network")).toBe("globe");
    expect(parsedUrl.searchParams.get("status")).toBe("success");
    expect(init?.method).toBe("GET");
    expect(init?.headers).toEqual({ accept: "application/json" });
    expect(init?.body).toBeUndefined();
    expect(result.data).toEqual([
      {
        messageId: "retrieved-1",
        recipient: "639171234567",
        senderName: "Alerts",
        status: "success",
        rawStatus: "Success",
      },
    ]);
    expect(result.meta.rateLimit).toEqual({
      limit: 30,
      remaining: 29,
      retryAfterSeconds: null,
    });
  });

  it("returns an individual message by id", async () => {
    const transport = vi.fn<HttpTransport>().mockResolvedValue(
      response({
        message_id: 42,
        recipient: "639171234567",
        status: "Sent",
      }),
    );
    const client = new SemaphoreClient({
      apiKey: "test-api-key",
      transport,
    });

    const result = await client.messages.get(42);

    const [url, init] = transport.mock.calls[0];
    expect(url).toBe(
      "https://api.semaphore.co/api/v4/messages/42?apikey=test-api-key",
    );
    expect(init?.method).toBe("GET");
    expect(result.data).toEqual({
      messageId: "42",
      recipient: "639171234567",
      senderName: null,
      status: "sent",
      rawStatus: "Sent",
    });
  });

  it("accepts an empty result page", async () => {
    const transport = vi.fn<HttpTransport>().mockResolvedValue(response([]));
    const client = new SemaphoreClient({
      apiKey: "test-api-key",
      transport,
    });

    await expect(client.messages.list()).resolves.toMatchObject({ data: [] });
  });

  it.each([
    ["a zero limit", { limit: 0 }],
    ["a limit above the provider maximum", { limit: 1_001 }],
    ["a zero page", { page: 0 }],
    ["an invalid date", { startDate: "2026-02-30" }],
    [
      "a reversed date range",
      { startDate: "2026-02-02", endDate: "2026-02-01" },
    ],
    ["a blank network", { network: " " }],
    ["a blank status", { status: " " }],
  ])("rejects %s before dispatch", async (_label, input) => {
    const transport = vi.fn<HttpTransport>();
    const client = new SemaphoreClient({ apiKey: "test-api-key", transport });

    await expect(client.messages.list(input)).rejects.toBeInstanceOf(
      SemaphoreValidationError,
    );
    expect(transport).not.toHaveBeenCalled();
  });

  it("rejects a blank message id before dispatch", async () => {
    const transport = vi.fn<HttpTransport>();
    const client = new SemaphoreClient({ apiKey: "test-api-key", transport });

    await expect(client.messages.get(" ")).rejects.toBeInstanceOf(
      SemaphoreValidationError,
    );
    expect(transport).not.toHaveBeenCalled();
  });
});
