# Nezha Kumo Admin

Management frontend releases for [Nezha Kumo](https://github.com/zhdsmy/nezha-kumo-theme), licensed under MIT. Source code, screenshots and release notes live in that repository.

In Nezha v2.6.0 or later, open **Settings → Frontends → Admin**, enter `https://github.com/zhdsmy/nezha-kumo-admin`, select a release, install it, then activate it. The admin interface opens at `/dashboard/`. Keep an administrator PAT available to restore the built-in `admin-dist` through `POST /api/v1/frontend/activate` if needed.

To initialize this release-only repository, copy this README and the adjacent `.github/workflows/release.yml` to its root. Publish the matching `vX.Y.Z` release in `zhdsmy/nezha-kumo-theme` first, then push the same tag here. The workflow anonymously downloads and checks the admin artifact, and republishes it as `dist.zip` using this repository's own `GITHUB_TOKEN`. No cross-repository token is required.
