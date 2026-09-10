# Contributing

Thank you for helping improve the Semaphore SMS SDK. Contributions should keep
the public API predictable, protect user data, and include tests for behavior
that can affect callers.

## Prerequisites

- Node.js `>=18.17.0`
- pnpm `12.3.4`
- Git

## Local setup

```bash
git clone https://github.com/pravennn08/semaphore-sdk.git
cd semaphore-sdk
pnpm install --frozen-lockfile
```

## Development workflow

Create a focused branch from `main`:

```bash
git switch -c feat/short-description
```

Keep endpoint-specific behavior in `src/resource/`, shared HTTP behavior in
`src/core/`, and supported imports in `src/index.ts`. Use the injectable fake
transport in tests. Do not use live API credentials or send real SMS from the
test suite.

Run the checks before opening a pull request:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:package
```

Use `pnpm format` to apply formatting fixes. Update the README or API behavior
documentation when a public method, error, or provider contract changes.

## Commits and pull requests

Use a clear, imperative commit subject with a conventional prefix, for example:

```text
feat: add priority message support
fix: classify malformed provider responses
docs: clarify package installation
```

Pull requests should explain the user-visible change, include focused tests,
and mention any provider documentation used to verify the request or response
contract. Keep pull requests small enough to review and remove secrets or
personal data from logs and examples.

## Reporting issues

Use the repository issue templates for bugs and feature requests. Report
security vulnerabilities privately according to [SECURITY.md](./SECURITY.md).
