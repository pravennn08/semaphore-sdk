# API Behavior

## Client construction

Create a `SemaphoreClient` with a nonblank `apiKey`. `defaultSender` is optional,
`timeoutMs` defaults to 10 seconds, and `transport` defaults to the runtime's
native `fetch` implementation. Invalid options throw `SemaphoreConfigError`
while the client is being constructed, before a request can be sent.

## Sending messages

`client.messages.send({ to, message, senderName })` accepts one Philippine mobile
number or an array of up to 1,000 numbers. Numbers in `09...`, `9...`, `639...`,
and `+639...` forms are normalized to the provider's `639...` form. Duplicates
are preserved because recipient order is part of the request input.

The message body is sent exactly as supplied after validation. Blank messages,
messages beginning with `TEST`, invalid recipients, and blank sender names throw
`SemaphoreValidationError` before the transport is called. A per-call
`senderName` overrides the configured default.

## Results and errors

Successful calls return `{ data, meta }`. `data` contains normalized message
records and `meta` contains the HTTP status and parsed rate-limit headers.
Provider statuses outside the known set are retained in `rawStatus` and exposed
as `status: "unknown"`.

`SemaphoreApiError` exposes a stable `kind` and `submission` classification:

- `http` with `submission: "rejected"` means the provider explicitly rejected a
  request with a known client-side status.
- `http`, `transport`, `timeout`, `cancelled`, or `invalid_response` with
  `submission: "unknown"` means acceptance cannot be confirmed after dispatch.
- Cancellation detected before dispatch is reported with
  `submission: "not_sent"`.

SMS sends are never retried automatically. A timeout, cancellation, transport
failure, or malformed response must be treated as an uncertain outcome by the
calling application before it decides whether to send again.

## OTP sends

`client.otp.send({ to, message, code, senderName })` uses the provider's
dedicated OTP route. The SDK accepts one recipient for an OTP request. The
message may contain `{otp}`; when it does not, the provider appends the code to
the message. Omitting `code` asks the provider to generate one. Supplying a
numeric string preserves leading zeroes, while numeric codes are serialized as
their decimal representation.

The provider response must contain a code. It is returned as the normalized
string `data[0].code` alongside the ordinary message fields. A missing or
malformed code is an `invalid_response` with an uncertain submission state.

## Priority sends

`client.priority.send({ to, message, senderName })` uses the provider's
`POST /api/v4/priority` route. It accepts the same recipient forms, message
validation, sender override, response mapping, timeout, cancellation, and error
classification as `client.messages.send()`.

Priority requests are still SMS submissions: the SDK does not retry them, and a
timeout or transport failure must be treated as an uncertain outcome. Provider
queue priority, rate limits, and credit costs are documented by
[Semaphore](https://www.semaphore.co/docs).

## Retrieving messages

`client.messages.list(input, options)` sends a `GET` request to
`/api/v4/messages`. The optional input supports `limit` (1–1,000), `page`,
`startDate`, `endDate`, `network`, and `status` filters. Dates use `YYYY-MM-DD`
format; network and status filters are normalized to lowercase. An empty result
page returns `{ data: [], meta }`.

`client.messages.get(messageId, options)` sends a `GET` request to
`/api/v4/messages/{id}` and returns one normalized `SemaphoreMessage` in
`data`. The provider may return the single record as an object or a one-item
array; both forms are accepted. Message IDs must be nonblank strings or
nonnegative integers.

Retrieval requests do not submit SMS and are never automatically retried. The
provider limits message retrieval to 30 requests per minute; callers should use
the returned rate-limit metadata when polling or building dashboards.

## Account reads

The following methods use GET requests and the configured API key:

| Method                                               | Endpoint                       | `data`                          |
| ---------------------------------------------------- | ------------------------------ | ------------------------------- |
| `client.account.get(options?)`                       | `/api/v4/account`              | `SemaphoreAccount`              |
| `client.account.transactions.list(input?, options?)` | `/api/v4/account/transactions` | `SemaphoreAccountTransaction[]` |
| `client.account.senderNames.list(input?, options?)`  | `/api/v4/account/sendernames`  | `SemaphoreSenderName[]`         |
| `client.account.users.list(input?, options?)`        | `/api/v4/account/users`        | `SemaphoreAccountUser[]`        |

Each list accepts `ListAccountItemsInput`: `page` must be a positive safe integer,
and `limit` must be an integer from 1 through 1,000. Omitted parameters use the
provider defaults (page 1, limit 100). Invalid input fails before dispatch. Empty
arrays are valid pages; the SDK does not invent totals or fetch further pages.

Account details expose `accountId`, `accountName`, `status`, and `creditBalance`.
IDs become strings; finite numeric balances and decimal strings become JavaScript
numbers. Blank, null, boolean, and nonnumeric balances are rejected rather than
silently becoming zero. Account retrieval accepts one object or a one-item array.

Sender records expose `name`, `status`, and `createdAt`. The timestamp remains a
provider string without an assumed timezone; `createdAt` is `null` when
`created_at` is absent or null. User records expose `userId`, `email`, `role`, and
`status`; user `status` is `null` when absent or null. Live response shapes have
shown both omissions. The unrecognized sender field in the diagnostic is not
treated as a timestamp alias because its meaning has not been verified.
Status and role strings are preserved as returned; the SDK does not assume an
undocumented enum or infer an account user's status from missing data. Sender
name/status and user ID/email/role remain required. Missing required fields or
malformed values (including non-string or blank optional metadata when present)
produce `SemaphoreApiError` with `kind: "invalid_response"`.

The [provider documentation](https://www.semaphore.co/docs) repeats the account
detail fields under transactions and does not establish a transaction record
schema. `SemaphoreAccountTransaction` is therefore a
`Readonly<Record<string, unknown>>`: the SDK checks for an array of objects and
preserves their original field names and values. It does not guarantee names or
types for transaction amounts, IDs, or timestamps. Callers must narrow fields
against their observed provider responses. The transaction fixtures are
synthetic shape checks, not captured or confirmed live response samples.

The provider documents **2 requests per minute per account endpoint**, but the
live sender-name and user diagnostics reported `X-RateLimit-Limit: 1` and
`X-RateLimit-Remaining: 0`. The SDK preserves those values in `meta.rateLimit`;
applications must use the actual headers rather than hard-coding a quota of 2.
Construction performs no account requests. Each explicit operation makes one request, with no
automatic polling, retries, background work, or pagination. There is no SDK-wide
throttle across client instances: the application controls caching and request
frequency. On HTTP 429, the SDK exposes `statusCode: 429` and `retryAfterSeconds`;
successful responses include available rate-limit headers in `meta.rateLimit`.
For initial live checks, run one endpoint at a time with at least 60 seconds
between checks and respect a longer `Retry-After` if returned.

All methods accept the existing timeout and cancellation options. For read errors,
use `kind`, `statusCode`, and `retryAfterSeconds`; the shared `submission` field
does not describe the delivery state of any earlier SMS. These methods never send
SMS or change sender registrations or account membership.
