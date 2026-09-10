# Examples

These examples use the published package API and are written as TypeScript
source files. Build the SDK first so the package self-reference resolves:

```bash
pnpm build
```

Each example sends a real SMS and can consume Semaphore credits. Set the
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
