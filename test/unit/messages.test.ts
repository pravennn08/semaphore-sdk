import { describe, expect, it, vi } from "vitest";
import { SemaphoreClient } from "../../src/client.js";
import {
  SemaphoreApiError,
  SemaphoreValidationError,
} from "../../src/errors.js";
import type { HttpTransport } from "../../src/core/transport.js";

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
      "x-ratelimit-limit": "120",
      "x-ratelimit-remaining": "119",
    },
  });
}

describe("messages.send", () => {
  it("sends the documented form fields and maps provider records", async () => {
    const transport = vi.fn<HttpTransport>().mockResolvedValue(
      response([
        {
          message_id: 12345,
          recipient: "639171234567",
          sender_name: "DefaultSender",
          status: "Queued",
          future_field: "preserved by provider, ignored by SDK",
        },
        {
          message_id: "12346",
          recipient: "639181234567",
          status: "ProviderNewStatus",
        },
      ]),
    );
    const client = new SemaphoreClient({
      apiKey: "test-api-key",
      defaultSender: "DefaultSender",
      transport,
    });

    const result = await client.messages.send({
      to: ["0917 123 4567", "+63 (918) 123-4567", "639171234567"],
      message: "  Hello from the SDK  ",
      senderName: "OverrideSender",
    });

    expect(transport).toHaveBeenCalledTimes(1);
    const [url, init] = transport.mock.calls[0];
    expect(url).toBe("https://api.semaphore.co/api/v4/messages");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    });

    const form = init?.body as URLSearchParams;
    expect(form.get("apikey")).toBe("test-api-key");
    expect(form.get("number")).toBe("639171234567,639181234567,639171234567");
    expect(form.get("message")).toBe("  Hello from the SDK  ");
    expect(form.get("sendername")).toBe("OverrideSender");

    expect(result.data).toEqual([
      {
        messageId: "12345",
        recipient: "639171234567",
        senderName: "DefaultSender",
        status: "queued",
        rawStatus: "Queued",
      },
      {
        messageId: "12346",
        recipient: "639181234567",
        senderName: null,
        status: "unknown",
        rawStatus: "ProviderNewStatus",
      },
    ]);
    expect(result.meta.statusCode).toBe(200);
    expect(result.meta.rateLimit).toEqual({
      limit: 120,
      remaining: 119,
      retryAfterSeconds: null,
    });
  });

  it("uses the configured sender when a request sender is omitted", async () => {
    const transport = vi.fn<HttpTransport>().mockResolvedValue(
      response([
        {
          message_id: 12345,
          recipient: "639171234567",
          sender_name: "DefaultSender",
          status: "Pending",
        },
      ]),
    );
    const client = new SemaphoreClient({
      apiKey: "test-api-key",
      defaultSender: "DefaultSender",
      transport,
    });

    await client.messages.send({
      to: "9171234567",
      message: "Hello",
    });

    const form = transport.mock.calls[0][1]?.body as URLSearchParams;
    expect(form.get("sendername")).toBe("DefaultSender");
  });

  it("omits sendername when no sender is configured", async () => {
    const transport = vi.fn<HttpTransport>().mockResolvedValue(
      response([
        {
          message_id: 12345,
          recipient: "639171234567",
          status: "Sent",
        },
      ]),
    );
    const client = new SemaphoreClient({ apiKey: "test-api-key", transport });

    await client.messages.send({ to: "639171234567", message: "Hello" });

    const form = transport.mock.calls[0][1]?.body as URLSearchParams;
    expect(form.has("sendername")).toBe(false);
  });

  it.each([
    ["an empty recipient list", { to: [], message: "Hello" }],
    ["an invalid recipient", { to: "123", message: "Hello" }],
    ["a blank message", { to: "639171234567", message: " \t" }],
    ["a TEST message", { to: "639171234567", message: " TEST notice" }],
    [
      "a blank sender",
      {
        to: "639171234567",
        message: "Hello",
        senderName: " ",
      },
    ],
  ])("rejects %s before dispatch", async (_label, input) => {
    const transport = vi.fn<HttpTransport>();
    const client = new SemaphoreClient({ apiKey: "test-api-key", transport });

    await expect(client.messages.send(input)).rejects.toBeInstanceOf(
      SemaphoreValidationError,
    );
    expect(transport).not.toHaveBeenCalled();
  });

  it("does not automatically retry an uncertain submission", async () => {
    const transport = vi
      .fn<HttpTransport>()
      .mockRejectedValue(new Error("network"));
    const client = new SemaphoreClient({ apiKey: "test-api-key", transport });

    await expect(
      client.messages.send({ to: "639171234567", message: "Hello" }),
    ).rejects.toMatchObject<Partial<SemaphoreApiError>>({
      kind: "transport",
      submission: "unknown",
    });
    expect(transport).toHaveBeenCalledTimes(1);
  });
});
