# Nezha Kumo public frontend

Nezha v2.6.1+, React 19, Kumo 2.18.1, SVG charts. Nezha is the only backend.

From the repository root:

```sh
pnpm --filter frontend dev
pnpm --filter frontend test
pnpm --filter frontend package
```

For local read-only data, add `NKT_UPSTREAM=https://your-monitor.example` to
`apps/frontend/.env.local`. The dev proxy rejects write requests. Login/OAuth
acceptance uses Playwright mocks and never sends credentials to the upstream.

Packaging writes `release/nezha-kumo-frontend-v0.1.0.zip` and its SHA256 file.
The ZIP contains one folder, `kumo-dist/`, matching the Nezha folder layout.
Mount its contents at `/dashboard/user-dist` using the panel's existing theme
installation procedure. This package does not deploy or change the panel.

`config.js` belongs to the site owner and is excluded from the ZIP. On the first
installation, copy `apps/frontend/public/config.js` next to the extracted
`index.html`; keep the existing file on upgrades. Every setting is optional.
Preferences use the `nkt:` namespace. Only `window.NezhaKumoConfig` is read.

The home page uses one table tree: CSS turns its rows into compact cards below
`BREAKPOINTS.gutter`. Medium screens expand disk, traffic, uptime and billing in
a row. Node sections use hash URLs, so drawer links and browser history agree.
Guests see up to one day of history. Authenticated sessions get 7d/30d when TSDB
is enabled. The report grid records observed hours, not an uptime SLA. Monthly
quota usage is withheld when the API's cumulative counter window does not match
its billing period. Daily traffic sums servers with a current-day counter baseline and labels partial coverage.
All HTTP requests share a four-request queue; counters refresh at most every ten minutes,
and refreshes pause while the tab is hidden.
