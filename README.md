<div align="center">

# Semaphore SMS SDK for TypeScript

### Type-safe SMS integration with clear contracts and predictable request behavior

A TypeScript library for integrating the [Semaphore SMS API](https://semaphore.co/)
into Node.js applications. It provides native `fetch`, strict types, input and
response validation, injectable transports, and stable error classifications.

[![npm version](https://img.shields.io/npm/v/semaphore-sdk?style=flat-square)](https://www.npmjs.com/package/semaphore-sdk)
[![GitHub release](https://img.shields.io/github/v/release/pravennn08/semaphore-sdk?style=flat-square)](https://github.com/pravennn08/semaphore-sdk/releases)
[![Socket Badge](https://badge.socket.dev/npm/package/semaphore-sdk)](https://socket.dev/npm/package/semaphore-sdk)
[![CI](https://github.com/pravennn08/semaphore-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/pravennn08/semaphore-sdk/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](./LICENSE)

[Installation](#installation) · [Quick Start](#quick-start) · [Supported APIs](#supported-apis) · [Configuration](#configuration) · [Errors](#errors-and-submission-safety) · [Development](#development)

</div>

---

> [!WARNING]
> SMS submissions can incur charges and contact real recipients. A timeout or unreadable response does not prove that a message was not accepted. The SDK never automatically retries SMS submissions.

## Overview

`semaphore-sdk` is an independent, ESM-only TypeScript SDK for the Semaphore
Philippines SMS API. It keeps provider-specific HTTP details inside resources
while exposing a small public client:

- `client.messages.send()` for standard and bulk SMS
- `client.messages.list()` and `client.messages.get()` for message retrieval
- `client.priority.send()` for priority SMS
- `client.otp.send()` for dedicated OTP traffic
- `client.account` for account details, transactions, sender names, and users

The package requires Node.js `>=18.17.0` and uses the runtime's native `fetch`.
It does not load `.env` files automatically; load secrets in your application
and pass the API key to `SemaphoreClient`.

## Installation

```bash
npm install semaphore-sdk
# or
pnpm add semaphore-sdk
```

## Quick start

### Send a standard SMS

```ts
import { SemaphoreClient } from "semaphore-sdk";

const apiKey = process.env.SEMAPHORE_API_KEY;
if (!apiKey) {
  throw new Error("SEMAPHORE_API_KEY is required.");
}

const client = new SemaphoreClient({
  apiKey,
  defaultSender: process.env.SEMAPHORE_SENDER_NAME,
});

const result = await client.messages.send({
  to: "+639171234567",
  message: "Your verification code is 123456.",
});

console.log(result.data[0]?.messageId);
```

### Retrieve messages

List outgoing messages with pagination and filters, or retrieve one message by
its provider ID:

```ts
const messages = await client.messages.list({
  page: 1,
  limit: 100,
  status: "success",
});

const message = await client.messages.get("message-id");
```

### Send a priority SMS

Priority SMS uses the same input and output contract as standard SMS:

```ts
const result = await client.priority.send({
  to: "09171234567",
  message: "Your order is ready for pickup.",
});

console.log(result.data[0]?.status);
```

### Send an OTP

Use `{otp}` in the message template and read the generated code from the
response. You can also supply your own numeric code.

```ts
const result = await client.otp.send({
  to: "09171234567",
  message: "Your login code is {otp}.",
});

console.log(result.data[0]?.code);
```

### Read account information

```ts
const account = await client.account.get();
console.log(account.data.accountName);
console.log(account.data.status);
console.log(account.data.creditBalance);
```

Account list methods accept `{ page, limit }` and return one page per call.
Transactions preserve provider fields as `Readonly<Record<string, unknown>>`
because the provider's transaction response schema is unclear; narrow fields
before using them. See [account API behavior](./docs/api-behavior.md#account-reads)
for the response contracts and rate-limit guidance.

## Supported APIs

| Resource | Method                               | Behavior                                                                     |
| -------- | ------------------------------------ | ---------------------------------------------------------------------------- |
| Messages | `client.messages.send()`             | Sends one message to one or up to 1,000 Philippine mobile numbers.           |
| Messages | `client.messages.list()`             | Retrieves outgoing messages with pagination and optional filters.            |
| Messages | `client.messages.get()`              | Retrieves one outgoing message by its provider ID.                           |
| Priority | `client.priority.send()`             | Sends through Semaphore's priority queue with the standard SMS contract.     |
| OTP      | `client.otp.send()`                  | Sends through the dedicated OTP route and returns the provider code.         |
| Account  | `client.account.get()`               | Reads account ID, name, status, and credit balance.                          |
| Account  | `client.account.transactions.list()` | Reads one page of credit transaction records with provider fields preserved. |
| Account  | `client.account.senderNames.list()`  | Reads registered sender names and their statuses.                            |
| Account  | `client.account.users.list()`        | Reads users associated with the account.                                     |

Recipients in `09...`, `9...`, `639...`, and `+639...` forms are normalized to
the provider's `639...` format. Duplicate recipients are preserved. Blank or
`TEST`-prefixed messages, invalid recipients, and blank sender names are rejected
before a network request is made.

Message retrieval is limited to 30 requests per minute. The provider documents
2 requests per minute for each account endpoint, but live sender-name and user
responses have reported `X-RateLimit-Limit: 1`. Use the actual `meta.rateLimit`
headers rather than assuming the documented quota. Account methods make a single
request with no automatic pagination, polling, or retries. Cache account data
in your application and respect `Retry-After` when a request is rate limited.
Sender-name and user methods are read-only; they do not register senders or
change account membership.

Sender `createdAt` and user `status` are `null` when the provider omits those
fields or returns null. A missing status is not interpreted as active or inactive.

See the [Semaphore API documentation](https://www.semaphore.co/docs) for the
provider's endpoint parameters, limits, and account requirements.

## Configuration

`SemaphoreClient` validates its options before creating a request:

| Option          | Required | Description                                                               |
| --------------- | -------- | ------------------------------------------------------------------------- |
| `apiKey`        | Yes      | Nonblank Semaphore API key.                                               |
| `defaultSender` | No       | Sender name used when an operation does not provide one.                  |
| `timeoutMs`     | No       | Positive, finite timeout in milliseconds; defaults to `10_000`.           |
| `transport`     | No       | Injectable `fetch`-compatible transport for tests or custom integrations. |

Example environment variables:

```text
SEMAPHORE_API_KEY=your_api_key
SEMAPHORE_SENDER_NAME=your_registered_sender
```

Keep API keys server-side. Do not place them in browser bundles or public
`VITE_*` variables.

## Errors and submission safety

Successful operations return `{ data, meta }`. `data` contains normalized public
records (except transactions, which retain provider fields), while `meta`
includes the HTTP status and available rate-limit headers.

The SDK exposes `SemaphoreValidationError` for invalid input and
`SemaphoreApiError` for provider, transport, timeout, cancellation, and response
failures. API errors include stable `kind` and `submission` fields:

- `not_sent` — cancellation was detected before dispatch.
- `rejected` — the provider explicitly rejected the request.
- `unknown` — dispatch occurred but acceptance cannot be confirmed.

Timeouts, cancellations, transport failures, and malformed responses after
dispatch are uncertain outcomes. Reconcile them using your application workflow
before deciding whether to submit another SMS.

## Development

Clone the repository and install its pinned dependencies:

```bash
git clone https://github.com/pravennn08/semaphore-sdk.git
cd semaphore-sdk
pnpm install --frozen-lockfile
```

Run the complete local checks:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:package
```

Tests use injectable fake transports and do not require live API credentials or
send real SMS. The [SMS examples](./examples/README.md) are opt-in live integrations
guarded by `SEMAPHORE_ALLOW_LIVE_SMS=true`. The account example only reads data
and selects one endpoint per run.

## Documentation and project links

- [API behavior](./docs/api-behavior.md)
- [Architecture guide](./docs/archicture.md)
- [Contributing guide](./CONTRIBUTING.md)
- [Security policy](./SECURITY.md)
- [Examples](./examples/README.md)
- [npm package](https://www.npmjs.com/package/semaphore-sdk)
- [GitHub releases](https://github.com/pravennn08/semaphore-sdk/releases)
- [Repository](https://github.com/pravennn08/semaphore-sdk)

This project is independent and is not presented as an official Semaphore-maintained package.
