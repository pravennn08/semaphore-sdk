# Examples

These examples use the published package API and are written as TypeScript
source files. Build the SDK first so the package self-reference resolves:

```bash
pnpm build
```

## SMS examples

The send examples send a real SMS and can consume Semaphore credits. Set the
following environment variables in your shell before running one:

```text
SEMAPHORE_API_KEY=your_api_key
SEMAPHORE_RECIPIENT=639171234567
SEMAPHORE_SENDER_NAME=your_registered_sender
SEMAPHORE_ALLOW_LIVE_SMS=true
```

In PowerShell, set them with:

```powershell
$env:SEMAPHORE_API_KEY = "your_api_key"
$env:SEMAPHORE_RECIPIENT = "639171234567"
$env:SEMAPHORE_SENDER_NAME = "your_registered_sender"
$env:SEMAPHORE_ALLOW_LIVE_SMS = "true"
```

In Command Prompt, use `set "NAME=value"` for the same variables.

The explicit `SEMAPHORE_ALLOW_LIVE_SMS=true` flag prevents accidental sends.
Run an example with Node.js 22 or newer:

```bash
node --experimental-strip-types examples/send-message.ts
node --experimental-strip-types examples/send-priority.ts
node --experimental-strip-types examples/send-otp.ts
```

Use fake transports in automated tests. Do not commit `.env` files, API keys,
phone numbers, OTPs, or message bodies.

## Account example

`read-account.ts` reads one endpoint per invocation and requires only
`SEMAPHORE_API_KEY`. It does not send SMS or require the live-SMS flag.
After building the SDK, run with Node.js 22 or newer:

```bash
node --experimental-strip-types examples/read-account.ts account
```

Replace the final argument with `transactions`, `senderNames`, or `users` to
check another resource. List requests fetch page 1 with at most five records.
For initial live checks, wait at least 60 seconds between commands, or longer
if the provider returns `Retry-After`. Do not run the commands in a polling loop.
Live sender-name and user headers have reported a limit of 1; do not assume the
documentation's quota of 2. Missing sender timestamps and user statuses appear
as `null` in the SDK output and do not indicate a request failure.

If your key is in a local `.env` file, load it explicitly in your own terminal:

```bash
node --env-file=.env --experimental-strip-types examples/read-account.ts account
```

The output contains account information; keep it local. Transaction fields are
returned as provided because their record schema is not reliably documented.
These live checks are manual and are never part of the automated test suite.

### Inspect an account response mismatch

If sender names or users return HTTP 200 but the SDK reports `invalid_response`,
inspect the response structure locally:

```bash
node --env-file=.env examples/inspect-account-response.mjs senderNames
```

Wait at least 60 seconds before running the same command with `users` as its
last argument. Each diagnostic makes one GET request and does not retry. It
prints only HTTP status, numeric rate-limit metadata, known field names, and
value types. Unknown field names are masked because they may contain personal
data. Up to five records and five levels of nesting are shown. Raw values,
credentials, URLs, and non-JSON response bodies are never printed.

Share this diagnostic output when reporting a response mismatch. A successful
diagnostic only inspects the response; it does not mean the SDK parser passed.
