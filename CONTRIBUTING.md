# Contributing

## Development Commands

Requires **Node.js 22+** and **pnpm** (`corepack enable`). Run from the repository root:

```bash
pnpm install                          # Install workspace dependencies
pnpm check                            # Typecheck, test, and build all packages
pnpm --filter frontend dev            # Public frontend dev server (127.0.0.1:5301)
pnpm --filter frontend test           # Frontend Vitest + mocked Playwright E2E
pnpm --filter admin-frontend dev      # Admin dev server (127.0.0.1, base /dashboard)
pnpm --filter admin-frontend test     # Admin Vitest suite
```

All PRs must pass `pnpm check` using mocked tests—never commit real hostnames, IPs, or personal billing data.

## Commit Conventions

Write concise **English Conventional Commits** (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`) with one logical change per commit.

## Shared Shell Rules (`packages/ui`)

Both `apps/frontend` and `apps/admin` mount the shared `AppShell` and `Page` in [`packages/ui/src/contract.ts`](packages/ui/src/contract.ts):

- **Contract stability**: Do not rename or alter `AppShellProps`, `PageProps`, `BREAKPOINTS` (`768` / `1280` / `1284`), or `SHELL` constants without discussing in an issue first.
- **Viewport height**: `.nk-shell` must use `height: 100dvh; overflow: hidden`—never `100vh` or `100svh`.
- **Single scroll container**: Vertical scrolling lives exclusively inside `.nk-main` (`getShellScroller()`); `document` stays unscrollable (`window.scrollY === 0`), keeping the top bar and desktop sidebar pinned as flex items rather than `position: fixed` or `sticky`.
- **Fold & narrow safety**: Below `768px`, desktop `.nk-sidebar:not([data-mobile])` hides in CSS before JS switches to the drawer, and `.nk-main` uses `container-type: inline-size` so narrowing never squeezes content.
