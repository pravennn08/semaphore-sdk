import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveClientConfig } from "../../src/config.js";
import type { SemaphoreClientOptions } from "../../src/config.js";
import type { HttpTransport } from "../../src/core/transport.js";
import { SemaphoreConfigError } from "../../src/errors.js";

describe("client configuration", () => {
  const networkFetch = vi.fn<HttpTransport>();
  const transport = vi.fn<HttpTransport>();

  beforeEach(() => {
    networkFetch.mockReset();
    transport.mockReset();
    vi.stubGlobal("fetch", networkFetch);
  });

  afterEach(() => {
    try {
      expect(networkFetch).not.toHaveBeenCalled();
      expect(transport).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("applies defaults without making a request", () => {
    const config = resolveClientConfig({ apiKey: "test-key" });

    expect(config.apiKey).toBe("test-key");
    expect(config.defaultSender).toBeUndefined();
    expect(config.timeoutMs).toBe(10_000);
    expect(config.transport).toBeTypeOf("function");
  });

  it("accepts explicit options and an injected transport", () => {
    const config = resolveClientConfig({
      apiKey: "test-key",
      defaultSender: "MySender",
      timeoutMs: 2_500,
      transport,
    });

    expect(config).toEqual({
      apiKey: "test-key",
      defaultSender: "MySender",
      timeoutMs: 2_500,
      transport,
    });
  });

  const invalidOverrides: Array<[string, Record<string, unknown>]> = [
    ["missing API key", { apiKey: undefined }],
    ["empty API key", { apiKey: "" }],
    ["whitespace API key", { apiKey: " \t " }],
    ["non-string API key", { apiKey: 123 }],
    ["blank sender", { defaultSender: " " }],
    ["null sender", { defaultSender: null }],
    ["zero timeout", { timeoutMs: 0 }],
    ["negative timeout", { timeoutMs: -1 }],
    ["NaN timeout", { timeoutMs: NaN }],
    ["infinite timeout", { timeoutMs: Infinity }],
    ["string timeout", { timeoutMs: "1000" }],
    ["null timeout", { timeoutMs: null }],
    ["null transport", { transport: null }],
    ["non-function transport", { transport: {} }],
  ];

  it.each(invalidOverrides)("rejects %s", (_label, overrides) => {
    const options = { apiKey: "test-key", transport, ...overrides };

    expect(() =>
      resolveClientConfig(options as unknown as SemaphoreClientOptions),
    ).toThrow(SemaphoreConfigError);
  });

  it("rejects missing options from an untyped caller", () => {
    expect(() =>
      resolveClientConfig(undefined as unknown as SemaphoreClientOptions),
    ).toThrow(SemaphoreConfigError);
  });

  it("keeps credentials out of validation error messages", () => {
    expect(() =>
      resolveClientConfig({
        apiKey: "fake-secret-key",
        timeoutMs: 0,
        transport,
      }),
    ).toThrow(/^timeoutMs must be a positive, finite number\.$/);
  });
});
