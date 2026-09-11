import { describe, expect, it, vi } from "vitest";
import {
  describeResponseShape,
  inspectAccountResponse,
} from "../../examples/inspect-account-response.mjs";

describe("account response diagnostic", () => {
  it("reports wrappers, types, blanks and nulls without exposing values or unknown keys", () => {
    const shape = describeResponseShape({
      data: [
        {
          id: 123456789,
          name: "PrivateSender",
          email: "private@example.com",
          status: 1,
          role: null,
          created_at: " ",
        },
      ],
      "private@example.com": "secret-key",
    });
    expect(shape).toMatchObject({
      type: "object",
      fields: {
        data: {
          type: "array",
          length: 1,
          items: [
            {
              type: "object",
              fields: {
                id: "number",
                name: "string",
                email: "string",
                status: "number",
                role: "null",
                created_at: "blank_string",
              },
            },
          ],
        },
        "[unrecognized field 2]": "string",
      },
    });
    for (const secret of [
      "123456789",
      "PrivateSender",
      "private@example.com",
      "secret-key",
    ]) {
      expect(JSON.stringify(shape)).not.toContain(secret);
    }
  });

  it.each(["senderNames", "users"])(
    "inspects %s with one read request and no retries",
    async (resource) => {
      const transport = vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify([{ name: "PrivateSender", user_id: 42 }]),
            { status: 200 },
          ),
        );
      const result = await inspectAccountResponse(
        resource,
        "secret-test-key",
        transport,
      );
      expect(transport).toHaveBeenCalledTimes(1);
      const [url, init] = transport.mock.calls[0];
      expect(url.origin).toBe("https://api.semaphore.co");
      expect(url.pathname).toBe(
        `/api/v4/account/${resource === "senderNames" ? "sendernames" : "users"}`,
      );
      expect(Object.fromEntries(url.searchParams)).toEqual({
        apikey: "secret-test-key",
        page: "1",
        limit: "5",
      });
      expect(init).toMatchObject({ method: "GET", redirect: "error" });
      expect(init.body).toBeUndefined();
      expect(result).toMatchObject({
        resource,
        statusCode: 200,
        bodyFormat: "json",
      });
      expect(JSON.stringify(result)).not.toContain("secret-test-key");
      expect(JSON.stringify(result)).not.toContain("PrivateSender");
    },
  );

  it("reports non-JSON responses and throttling without printing the body", async () => {
    const transport = vi.fn().mockResolvedValue(
      new Response("<html>secret-key private@example.com</html>", {
        status: 429,
        headers: { "retry-after": "60" },
      }),
    );
    const result = await inspectAccountResponse(
      "users",
      "secret-key",
      transport,
    );
    expect(result).toMatchObject({
      statusCode: 429,
      rateLimit: { retryAfterSeconds: 60 },
      bodyFormat: "not_json",
      shape: "body omitted",
    });
    expect(JSON.stringify(result)).not.toContain("secret-key");
    expect(JSON.stringify(result)).not.toContain("private@example.com");
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("rejects unsupported endpoints before dispatch", async () => {
    const transport = vi.fn();
    await expect(
      inspectAccountResponse("../messages", "secret-key", transport),
    ).rejects.toThrow("Choose senderNames or users.");
    expect(transport).not.toHaveBeenCalled();
  });
});
