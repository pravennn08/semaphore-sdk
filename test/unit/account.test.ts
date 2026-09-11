import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SemaphoreClient,
  SemaphoreApiError,
  SemaphoreValidationError,
} from "../../src/index.js";
import type {
  HttpTransport,
  ListAccountItemsInput,
  RequestOptions,
} from "../../src/index.js";
import {
  account,
  observedSenderNames,
  observedUsers,
  senderNames,
  transactions,
  users,
} from "../fixtures/account.js";

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "x-ratelimit-limit": "2", "x-ratelimit-remaining": "1" },
  });
}

function setup(payload: unknown) {
  const transport = vi
    .fn<HttpTransport>()
    .mockImplementation(async () => response(payload));
  const client = new SemaphoreClient({ apiKey: "account-test-key", transport });
  return { client, transport };
}

const lists = [
  {
    name: "transactions",
    path: "account/transactions",
    payload: transactions,
    expected: transactions,
  },
  {
    name: "senderNames",
    path: "account/sendernames",
    payload: senderNames,
    expected: [
      {
        name: "ExampleSMS",
        status: "Active",
        createdAt: "2026-01-01 10:00:00",
      },
    ],
  },
  {
    name: "users",
    path: "account/users",
    payload: users,
    expected: [
      {
        userId: "7",
        email: "owner@example.com",
        role: "Owner",
        status: "Active",
      },
    ],
  },
] as const;

const operations = [
  {
    name: "get",
    payload: account,
    run: (client: SemaphoreClient, options?: RequestOptions) =>
      client.account.get(options),
  },
  ...lists.map(({ name, payload }) => ({
    name,
    payload,
    run: (client: SemaphoreClient, options?: RequestOptions) =>
      client.account[name].list(undefined, options),
  })),
];

afterEach(() => vi.useRealTimers());

describe("account", () => {
  it("does not fetch account data during construction", () => {
    const { client, transport } = setup(account);
    expect(client.account).toBeDefined();
    expect(transport).not.toHaveBeenCalled();
  });

  it("retrieves and normalizes the account with metadata", async () => {
    const { client, transport } = setup(account);
    const result = await client.account.get();
    expect(result).toEqual({
      data: {
        accountId: "42",
        accountName: "Example Account",
        status: "Active",
        creditBalance: 1234.5,
      },
      meta: {
        statusCode: 200,
        rateLimit: { limit: 2, remaining: 1, retryAfterSeconds: null },
      },
    });
    expect(transport).toHaveBeenCalledExactlyOnceWith(
      "https://api.semaphore.co/api/v4/account?apikey=account-test-key",
      expect.objectContaining({
        method: "GET",
        redirect: "error",
        headers: { accept: "application/json" },
      }),
    );
    expect(transport.mock.calls[0][1]?.body).toBeUndefined();
  });

  it.each([0, 12.5, "0", "12.50", -1])(
    "accepts finite numeric balance %s",
    async (balance) => {
      const { client } = setup({ ...account, credit_balance: balance });
      await expect(client.account.get()).resolves.toMatchObject({
        data: { creditBalance: Number(balance) },
      });
    },
  );

  it("accepts a single-item account array and preserves string IDs and unfamiliar statuses", async () => {
    const { client } = setup([
      {
        ...account,
        account_id: "9007199254740993",
        status: "ProviderSpecificStatus",
      },
    ]);
    await expect(client.account.get()).resolves.toMatchObject({
      data: { accountId: "9007199254740993", status: "ProviderSpecificStatus" },
    });
  });

  it.each([
    null,
    [],
    [account, account],
    {},
    { ...account, account_id: Number.MAX_SAFE_INTEGER + 1 },
    { ...account, account_name: " " },
    { ...account, status: 1 },
    ...[undefined, null, true, "", " ", "NaN", "Infinity", "0x10", {}, []].map(
      (credit_balance) => ({ ...account, credit_balance }),
    ),
  ])("rejects malformed account payload %#", async (payload) => {
    const { client } = setup(payload);
    await expect(client.account.get()).rejects.toMatchObject({
      kind: "invalid_response",
      statusCode: 200,
    });
  });
});

describe.each(lists)(
  "account.$name.list",
  ({ name, path, payload, expected }) => {
    it("fetches one page with authentication and maps records", async () => {
      const { client, transport } = setup(payload);
      const result = await client.account[name].list({ page: 2, limit: 1_000 });
      expect(result.data).toEqual(expected);
      expect(result.meta.rateLimit).toMatchObject({ limit: 2, remaining: 1 });
      const [url, init] = transport.mock.calls[0];
      const parsed = new URL(String(url));
      expect(parsed.pathname).toBe(`/api/v4/${path}`);
      expect(Object.fromEntries(parsed.searchParams)).toEqual({
        apikey: "account-test-key",
        page: "2",
        limit: "1000",
      });
      expect(init).toMatchObject({ method: "GET", redirect: "error" });
      expect(init?.body).toBeUndefined();
      expect(transport).toHaveBeenCalledTimes(1);
    });

    it("allows empty pages and leaves omitted pagination to provider defaults", async () => {
      const { client, transport } = setup([]);
      await expect(client.account[name].list()).resolves.toMatchObject({
        data: [],
      });
      expect(transport.mock.calls[0][0]).toBe(
        `https://api.semaphore.co/api/v4/${path}?apikey=account-test-key`,
      );
    });

    it.each([
      null,
      [],
      "invalid",
      { page: 0 },
      { page: 1.5 },
      { page: NaN },
      { page: Number.MAX_SAFE_INTEGER + 1 },
      { page: "2" },
      { limit: -1 },
      { limit: 1_001 },
      { limit: Infinity },
      { limit: true },
    ])("rejects invalid pagination %# before dispatch", async (input) => {
      const { client, transport } = setup([]);
      await expect(
        client.account[name].list(input as ListAccountItemsInput),
      ).rejects.toBeInstanceOf(SemaphoreValidationError);
      expect(transport).not.toHaveBeenCalled();
    });

    it.each([null, {}, { error: "Invalid key" }, [null], ["invalid"], [[]]])(
      "rejects a malformed list response %#",
      async (payload) => {
        const { client } = setup(payload);
        await expect(client.account[name].list()).rejects.toMatchObject({
          kind: "invalid_response",
        });
      },
    );
  },
);

describe("account record validation", () => {
  it("accepts the observed sender response without created_at", async () => {
    const { client, transport } = setup(observedSenderNames);
    transport.mockResolvedValueOnce(
      new Response(JSON.stringify(observedSenderNames), {
        status: 200,
        headers: { "x-ratelimit-limit": "1", "x-ratelimit-remaining": "0" },
      }),
    );
    const result = await client.account.senderNames.list();
    expect(result.data).toEqual([
      { name: "ExampleSMS", status: "Active", createdAt: null },
      { name: "ExampleAlerts", status: "Active", createdAt: null },
    ]);
    expect(result.meta.rateLimit).toEqual({
      limit: 1,
      remaining: 0,
      retryAfterSeconds: null,
    });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("accepts the observed user response without status", async () => {
    const { client, transport } = setup(observedUsers);
    transport.mockResolvedValueOnce(
      new Response(JSON.stringify(observedUsers), {
        status: 200,
        headers: { "x-ratelimit-limit": "1", "x-ratelimit-remaining": "0" },
      }),
    );
    const result = await client.account.users.list();
    expect(result.data).toEqual([
      { userId: "7", email: "owner@example.com", role: "Owner", status: null },
    ]);
    expect(result.meta.rateLimit).toEqual({
      limit: 1,
      remaining: 0,
      retryAfterSeconds: null,
    });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("preserves explicit null metadata fields", async () => {
    const sender = setup([{ ...senderNames[0], created_at: null }]);
    const user = setup([{ ...users[0], status: null }]);
    await expect(
      sender.client.account.senderNames.list(),
    ).resolves.toMatchObject({ data: [{ createdAt: null }] });
    await expect(user.client.account.users.list()).resolves.toMatchObject({
      data: [{ status: null }],
    });
  });

  it.each([0, false, {}, [], "", " "])(
    "rejects present but malformed optional metadata %#",
    async (invalid) => {
      const sender = setup([{ ...senderNames[0], created_at: invalid }]);
      const user = setup([{ ...users[0], status: invalid }]);
      await expect(
        sender.client.account.senderNames.list(),
      ).rejects.toMatchObject({ kind: "invalid_response" });
      await expect(user.client.account.users.list()).rejects.toMatchObject({
        kind: "invalid_response",
      });
    },
  );

  it("rejects incomplete sender names", async () => {
    const { client } = setup([{ status: "Active" }]);
    await expect(client.account.senderNames.list()).rejects.toMatchObject({
      kind: "invalid_response",
    });
  });

  it("rejects incomplete user records", async () => {
    const { client } = setup([
      { user_id: 7, email: "owner@example.com", status: "Active" },
    ]);
    await expect(client.account.users.list()).rejects.toMatchObject({
      kind: "invalid_response",
    });
  });
});

describe.each(operations)(
  "account.$name request behavior",
  ({ payload, run }) => {
    it("performs no background polling after a successful response", async () => {
      vi.useFakeTimers();
      const { client, transport } = setup(payload);
      await run(client);
      await vi.advanceTimersByTimeAsync(120_000);
      expect(transport).toHaveBeenCalledTimes(1);
    });

    it("surfaces 429 and Retry-After without retrying or exposing the response body", async () => {
      vi.useFakeTimers();
      const transport = vi.fn<HttpTransport>().mockResolvedValue(
        new Response("private account-test-key owner@example.com", {
          status: 429,
          headers: { "retry-after": "60" },
        }),
      );
      const client = new SemaphoreClient({
        apiKey: "account-test-key",
        transport,
      });
      const error = await run(client).catch((error: unknown) => error);
      expect(error).toBeInstanceOf(SemaphoreApiError);
      expect(error).toMatchObject({
        kind: "http",
        statusCode: 429,
        retryAfterSeconds: 60,
      });
      expect(String(error)).not.toContain("account-test-key");
      expect(JSON.stringify(error)).not.toContain("owner@example.com");
      await vi.advanceTimersByTimeAsync(120_000);
      expect(transport).toHaveBeenCalledTimes(1);
    });

    it("honors cancellation before dispatch", async () => {
      const { client, transport } = setup(payload);
      const controller = new AbortController();
      controller.abort();
      await expect(
        run(client, { signal: controller.signal }),
      ).rejects.toMatchObject({ kind: "cancelled" });
      expect(transport).not.toHaveBeenCalled();
    });

    it("validates per-call timeouts before dispatch", async () => {
      const { client, transport } = setup(payload);
      await expect(run(client, { timeoutMs: 0 })).rejects.toBeInstanceOf(
        SemaphoreValidationError,
      );
      expect(transport).not.toHaveBeenCalled();
    });

    it("times out even when an injected transport ignores abort", async () => {
      vi.useFakeTimers();
      const transport = vi.fn<HttpTransport>(
        () => new Promise<Response>(() => undefined),
      );
      const client = new SemaphoreClient({
        apiKey: "account-test-key",
        transport,
      });
      const pending = run(client, { timeoutMs: 10 });
      const assertion = expect(pending).rejects.toMatchObject({
        kind: "timeout",
      });
      await vi.advanceTimersByTimeAsync(10);
      await assertion;
      expect(transport.mock.calls[0][1]?.signal?.aborted).toBe(true);
      expect(transport).toHaveBeenCalledTimes(1);
    });
  },
);
