# Maintaining the admin release repository

To initialize this release-only repository, copy `README.md` and the adjacent `.github/workflows/release.yml` to its root. Publish the matching `vX.Y.Z` release in `zhdsmy/nezha-kumo-theme` first, then push the same tag here. The workflow downloads and checks the admin artifact, reads the release notes through the GitHub API, and republishes it as `dist.zip`. It uses this repository's own `GITHUB_TOKEN` for the API call and the release, so anonymous API rate limits do not apply. No cross-repository token is required.

Keep this file in the source repository. Copy only `README.md` and `.github/workflows/release.yml` to the public admin repository.
