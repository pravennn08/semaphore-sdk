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
