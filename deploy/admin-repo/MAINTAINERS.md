# Maintaining the admin release repository

To initialize this release-only repository, copy `README.md` and the adjacent `.github/workflows/release.yml` to its root. Publish the matching `vX.Y.Z` release in `zhdsmy/nezha-kumo-theme` first, then push the same tag here. The workflow anonymously downloads and checks the admin artifact, and republishes it as `dist.zip` using this repository's own `GITHUB_TOKEN`. No cross-repository token is required.

Keep this file in the source repository. Copy only `README.md` and `.github/workflows/release.yml` to the public admin repository.
