# Admin Panel (`apps/admin`)

Developer guide for the Kumo-reskinned Nezha admin panel (`/dashboard/`). For installation, release artifacts (`zhdsmy/nezha-kumo-admin`), and rollback instructions, see the [root README](../../README.md).

## Commands

Run from the repository root:

```bash
pnpm --filter admin-frontend dev      # Vite dev server on 127.0.0.1 (base /dashboard)
pnpm --filter admin-frontend test     # Vitest + Testing Library suite (src/test/)
pnpm --filter admin-frontend lint     # oxlint
pnpm --filter admin-frontend format   # Prettier write
pnpm --filter admin-frontend build    # tsc -b && vite build -> dist/
pnpm --filter admin-frontend preview  # Serve built dist/ locally
```

## Local Backend Proxy & Mocked E2E

- **Local backend proxy**: `pnpm --filter admin-frontend dev` proxies `/api` (including `/api/v1/ws/*`) and `/mcp` to `NEZHA_DEV_BACKEND` (defaults to `http://127.0.0.1:8008`).
- **Mocked Playwright E2E**: UI specs such as `tests/e2e/public-note.spec.ts` mock `/api/v1/**` in-browser via `page.route()`. Build and serve `dist/` with `vite preview`, then point Playwright at it with `E2E_SKIP_WEBSERVER=1`:

    ```bash
    pnpm --filter admin-frontend build
    pnpm --filter admin-frontend exec vite preview --host 127.0.0.1 --port 5382 --strictPort &
    E2E_SKIP_WEBSERVER=1 E2E_BASE_URL=http://127.0.0.1:5382 \
      pnpm --filter admin-frontend exec playwright test tests/e2e/public-note.spec.ts
    ```

- **OpenAPI types**: To regenerate `src/types/api.ts` from a local Nezha dashboard Swagger endpoint:

    ```bash
    pnpm --filter admin-frontend exec swagger-typescript-api \
      -p http://127.0.0.1:8008/swagger/doc.json -o ./src/types -n api.ts --no-client --union-enums
    ```
