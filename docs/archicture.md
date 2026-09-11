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
`client.priority.send`, and `client.otp.send`. Priority messages reuse the
standard message schema and mapper because the provider uses the same request
and response contract. Message retrieval reuses the response mapper while using
the request core's GET query support. New resources should add their own public
types and endpoint resource, then reuse the request executor instead of
duplicating authentication or retry behavior.
