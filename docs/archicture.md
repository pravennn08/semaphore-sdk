# SDK Architecture

The SDK is organized as a small dependency graph with one public assembly
point:

```text
src/
├── index.ts                         public exports
├── client.ts                        client assembly
├── config.ts                        option validation and defaults
├── errors.ts                        stable error classes and classifications
├── resource/
│   ├── validation.ts                 shared recipient, message, and sender validation
│   ├── pagination.ts                 shared page and limit validation
│   ├── account/
│   │   ├── types.ts                  account, transaction, sender, and user contracts
│   │   ├── schema.ts                 pagination and provider response validation
│   │   ├── mapper.ts                 documented provider fields to public models
│   │   └── resource.ts               account.get and the three account list resources
│   ├── messages/
│   │   ├── types.ts                  public message contracts
│   │   ├── schema.ts                 input and provider-shape validation
│   │   ├── mapper.ts                 provider records to public models
│   │   └── resource.ts               messages.send, list, and get operations
│   ├── otp/
│   │   ├── types.ts                  public OTP contracts
│   │   ├── schema.ts                 OTP input and response validation
│   │   ├── mapper.ts                 provider records to public models
│   │   └── resource.ts               otp.send operation
│   └── priority/
│       ├── types.ts                  public priority message contracts
│       └── resource.ts               priority.send operation
├── core/
│   ├── request.ts                   auth, form encoding, timeout, cancellation,
│   │                                response parsing, and error translation
│   ├── transport.ts                 native fetch type and default transport
│   └── redact.ts                    reserved diagnostics helper
```

The client validates options, creates one request executor, and injects that
executor into each resource. Resources know endpoint paths and provider fields;
the request core owns shared HTTP behavior. The core does not import a resource,
which keeps OTP, priority, and account resources independent.

Tests live under `test/unit` and replace the transport with fakes. They verify
that invalid configuration and invalid message inputs fail before dispatch,
while timeouts, cancellations, provider rejections, malformed responses, and
unknown statuses remain observable through stable error and result fields.

The current vertical slice implements client configuration,
`client.messages.send`, `client.messages.list`, `client.messages.get`,
`client.priority.send`, `client.otp.send`, and `client.account` with nested
transaction, sender-name, and user list resources. Priority messages reuse the
standard message schema and mapper because the provider uses the same request
and response contract. Message retrieval reuses the response mapper while using
the request core's GET query support. New resources should add their own public
types and endpoint resource, then reuse the request executor instead of
duplicating authentication or retry behavior.

Account methods reuse GET authentication, timeouts, cancellation, and error
translation. Account and message lists share pagination validation. Account
details, sender names, and users have validated mapped models; transaction
objects preserve unknown provider fields because the documented schema is
incomplete. Account methods never poll or retry automatically. Applications own
caching and scheduling within the provider's low account rate limits.

Account fixtures in `test/fixtures/account.ts` use synthetic values and include
the documented shapes plus reconstructed shapes from redacted live diagnostics.
The live sender records omit `created_at`, and live user records omit `status`;
these optional fields map to null while required fields remain validated.
Unit tests verify
the complete public client calls through an injected transport, including the
absence of background requests. The packed consumer test verifies that all four
account methods and their public declarations work outside the source tree.
