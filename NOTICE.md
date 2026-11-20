# Third-party notices

## Libraries & Fonts

- **Kumo** (`@cloudflare/kumo`), MIT License, Copyright (c) 2026 Cloudflare, Inc. Used as a dependency for UI components and design tokens.
- **Inter** (`@fontsource-variable/inter`, packaged by [Fontsource](https://github.com/fontsource/fontsource) from [rsms/inter](https://github.com/rsms/inter)), SIL Open Font License 1.1 (`OFL-1.1`), Copyright (c) 2016 The Inter Project Authors, with Reserved Font Name "Inter".

## Upstream Codebases

- **apps/admin** starts from [nezhahq/admin-frontend](https://github.com/nezhahq/admin-frontend) through the fork [zhdsmy/nezha-admin-frontend](https://github.com/zhdsmy/nezha-admin-frontend) at commit `8496d82` (`v2.6.1-zool.4`). Upstream license: WTFPL, kept in [`apps/admin/LICENSE.upstream-WTFPL`](apps/admin/LICENSE.upstream-WTFPL).
- **apps/frontend** reuses the Nezha data layer of [zool-theme](https://github.com/foru17/zool-theme) (MIT, Copyright (c) luoleiorg) through the fork [zhdsmy/zool-theme](https://github.com/zhdsmy/zool-theme). Copied and adapted files keep a header comment naming their source.

## Public Assets (`public/`)

- **`apps/frontend/public/flags/*.svg`** (4:3 SVG region flags): from [lipis/flag-icons](https://github.com/lipis/flag-icons) v7.3.2 (commit `fe15c16`), MIT License, Copyright (c) 2013 Panayiotis Lipiridis (license kept in [`apps/frontend/public/flags/LICENSE.txt`](apps/frontend/public/flags/LICENSE.txt)).
- **`apps/frontend/public/assets/apple-touch-icon.svg`**, **`apps/frontend/public/assets/apple-touch-icon.png`**, and **`apps/frontend/public/assets/apple-touch-icon-512.png`**: original Nezha "N" badge vector and rasterized PNG icons authored by `zhdsmy` for this project, licensed under the repository [MIT License](LICENSE).
- **`apps/admin/public/logo.svg`**: imported from [nezhahq/admin-frontend](https://github.com/nezhahq/admin-frontend) (`public/logo.svg`, commit `017e6cf`), distributed under upstream WTFPL ([`apps/admin/LICENSE.upstream-WTFPL`](apps/admin/LICENSE.upstream-WTFPL)).

## Trademark Disclaimer

This project is not affiliated with or endorsed by Cloudflare, Inc. "Cloudflare" and the Cloudflare logo are trademarks of Cloudflare, Inc. and are not used in this theme.

## VPS group icons

Both distributions include [vps-icons v1.4.0](https://github.com/zhdsmy/vps-icons/tree/v1.4.0) at commit `79c5441af8518eb7ae4646835333b5230a08085d`. The project is MIT licensed, copyright (c) 2026 zhdsmy and contributors. Brand rights belong to their respective owners. The bundled [license](packages/shared/vps-icons/v1.4.0/LICENSE.txt) and [per-icon sources and terms](packages/shared/vps-icons/v1.4.0/SOURCES.txt) accompany both copies.
