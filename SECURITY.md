# Security Policy

## Reporting a Vulnerability

Please **do not** report security vulnerabilities through public GitHub issues, discussions, or pull requests.

Instead, submit a report privately via **[GitHub Private Vulnerability Reporting](https://github.com/zhdsmy/nezha-kumo-theme/security/advisories/new)** (`Security` → `Report a vulnerability` on this repository). This covers both the user frontend (`zhdsmy/nezha-kumo-theme`) and the admin panel (`zhdsmy/nezha-kumo-admin`).

When reporting, please include:

- Affected component (`apps/frontend`, `apps/admin`, or `packages/shared` / `packages/ui`) and release version or commit SHA.
- Nezha Dashboard version (for example `v2.6.1`).
- Minimal reproduction steps or proof-of-concept payload (redacting any personal domains, tokens, or credentials).
- Potential impact (for example XSS via `public_note` / `custom_code`, CSRF, or authentication bypass).
