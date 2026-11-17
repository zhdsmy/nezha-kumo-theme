# Public Frontend (`apps/frontend`)

Developer guide for the public status frontend (`/`). For installation, configuration, and `public_note` schema documentation, see the [root README](../../README.md).

## Commands

Run from the repository root:

```bash
pnpm --filter frontend dev           # Vite dev server on http://127.0.0.1:5301
pnpm --filter frontend typecheck     # tsc --noEmit
pnpm --filter frontend lint          # oxlint across packages/ui and apps/frontend
pnpm --filter frontend format:check  # Prettier check
pnpm --filter frontend test:unit     # Vitest unit & contract tests (tests/*.test.ts)
pnpm --filter frontend test:e2e      # Playwright E2E suite (tests/*.spec.ts)
pnpm --filter frontend test          # Run unit + E2E suites
pnpm --filter frontend build         # Typecheck + production bundle in dist/
pnpm --filter frontend check:size    # Verify bundle size budgets
pnpm --filter frontend package       # Build, check budgets, and create release zip
```

## Read-Only Dev Proxy

To preview against real read-only panel data locally, create `apps/frontend/.env.local`:

```ini
NKT_UPSTREAM=https://status.example.com
```

`vite.config.ts` proxies `/api` (HTTP `GET`/`HEAD` and WebSocket) to `NKT_UPSTREAM` and rejects all mutating HTTP methods with `405`.

## Mocked E2E Tests

Playwright specs in `tests/*.spec.ts` use `mockNezha()` (`tests/mock.ts`) and static JSON fixtures in `tests/fixtures/` to mock `/api/v1/*`, `/api/v1/ws/server`, and `api.frankfurter.dev`. No live Nezha backend or credentials are required. Set `NKT_PORT=<port>` to run Playwright's dev server on a non-default port.
