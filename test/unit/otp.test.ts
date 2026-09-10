import { describe, expect, it, vi } from "vitest";
import { SemaphoreClient } from "../../src/client.js";
import {
  SemaphoreApiError,
  SemaphoreValidationError,
} from "../../src/errors.js";
import type { HttpTransport } from "../../src/core/transport.js";
import type { SendOtpInput } from "../../src/resource/otp/types.js";

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("otp.send", () => {
  it("sends to the OTP endpoint and maps the returned code", async () => {
    const transport = vi.fn<HttpTransport>().mockResolvedValue(
      response([
        {
          message_id: 12345,
          recipient: "639171234567",
          status: "Pending",
          code: 332200,
          sender_name: "DefaultSender",
        },
      ]),
    );
    const client = new SemaphoreClient({
      apiKey: "test-api-key",
      defaultSender: "DefaultSender",
      transport,
    });

    const result = await client.otp.send({
      to: "+63 (917) 123-4567",
      message: "Your code is {otp}.",
    });

    expect(transport).toHaveBeenCalledTimes(1);
    const [url, init] = transport.mock.calls[0];
    expect(url).toBe("https://api.semaphore.co/api/v4/otp");
    expect(init?.method).toBe("POST");
    const form = init?.body as URLSearchParams;
    expect(form.get("apikey")).toBe("test-api-key");
    expect(form.get("number")).toBe("639171234567");
    expect(form.get("message")).toBe("Your code is {otp}.");
    expect(form.get("sendername")).toBe("DefaultSender");
    expect(form.has("code")).toBe(false);
    expect(result.data[0]).toEqual({
      messageId: "12345",
      recipient: "639171234567",
      senderName: "DefaultSender",
      status: "pending",
      rawStatus: "Pending",
      code: "332200",
    });
  });

  it("sends a custom code without losing leading zeroes", async () => {
    const transport = vi.fn<HttpTransport>().mockResolvedValue(
      response([
        {
          message_id: "custom-code",
          recipient: "639171234567",
          status: "Queued",
          code: "004211",
        },
      ]),
    );
    const client = new SemaphoreClient({
      apiKey: "test-api-key",
      transport,
    });

    await client.otp.send({
      to: "09171234567",
      message: "Use {otp} to continue.",
      code: "004211",
      senderName: "OverrideSender",
    });

    const form = transport.mock.calls[0][1]?.body as URLSearchParams;
    expect(form.get("code")).toBe("004211");
    expect(form.get("sendername")).toBe("OverrideSender");
  });

  it.each([
    ["an invalid recipient", { to: "123", message: "Use {otp}" }],
    ["an array recipient", { to: ["639171234567"], message: "Use {otp}" }],
    ["a blank code", { to: "639171234567", message: "Use {otp}", code: " " }],
    [
      "a nonnumeric code",
      { to: "639171234567", message: "Use {otp}", code: "ABC123" },
    ],
    ["a blank message", { to: "639171234567", message: " " }],
    ["a TEST message", { to: "639171234567", message: "TEST Use {otp}" }],
  ])("rejects %s before dispatch", async (_label, input) => {
    const transport = vi.fn<HttpTransport>();
    const client = new SemaphoreClient({ apiKey: "test-api-key", transport });

    await expect(
      client.otp.send(input as unknown as SendOtpInput),
    ).rejects.toBeInstanceOf(SemaphoreValidationError);
    expect(transport).not.toHaveBeenCalled();
  });

  it("treats a missing provider code as an uncertain invalid response", async () => {
    const transport = vi.fn<HttpTransport>().mockResolvedValue(
      response([
        {
          message_id: 12345,
          recipient: "639171234567",
          status: "Queued",
        },
      ]),
    );
    const client = new SemaphoreClient({ apiKey: "test-api-key", transport });

    await expect(
      client.otp.send({ to: "639171234567", message: "Use {otp}" }),
    ).rejects.toMatchObject<Partial<SemaphoreApiError>>({
      kind: "invalid_response",
      submission: "unknown",
    });
    expect(transport).toHaveBeenCalledTimes(1);
  });
});
