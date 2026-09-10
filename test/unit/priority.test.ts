import { describe, expect, it, vi } from "vitest";
import { SemaphoreClient } from "../../src/client.js";
import { SemaphoreValidationError } from "../../src/errors.js";
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

describe("priority.send", () => {
  it("uses the priority endpoint with the standard SMS contract", async () => {
    const transport = vi.fn<HttpTransport>().mockResolvedValue(
      response([
        {
          message_id: "priority-1",
          recipient: "639171234567",
          sender_name: "Alerts",
          status: "Queued",
        },
      ]),
    );
    const client = new SemaphoreClient({
      apiKey: "test-api-key",
      defaultSender: "Alerts",
      transport,
    });

    const result = await client.priority.send({
      to: "+639171234567",
      message: "Priority notification",
    });

    expect(transport).toHaveBeenCalledTimes(1);
    const [url, init] = transport.mock.calls[0];
    expect(url).toBe("https://api.semaphore.co/api/v4/priority");
    expect(init?.method).toBe("POST");
    const form = init?.body as URLSearchParams;
    expect(form.get("apikey")).toBe("test-api-key");
    expect(form.get("number")).toBe("639171234567");
    expect(form.get("message")).toBe("Priority notification");
    expect(form.get("sendername")).toBe("Alerts");
    expect(result.data).toEqual([
      {
        messageId: "priority-1",
        recipient: "639171234567",
        senderName: "Alerts",
        status: "queued",
        rawStatus: "Queued",
      },
    ]);
    expect(result.meta.rateLimit).toEqual({
      limit: 120,
      remaining: 119,
      retryAfterSeconds: null,
    });
  });

  it("rejects invalid input before dispatch", async () => {
    const transport = vi.fn<HttpTransport>();
    const client = new SemaphoreClient({ apiKey: "test-api-key", transport });

    await expect(
      client.priority.send({ to: "123", message: "Priority notification" }),
    ).rejects.toBeInstanceOf(SemaphoreValidationError);
    expect(transport).not.toHaveBeenCalled();
  });
});
