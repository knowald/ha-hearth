# Releasing Hearth

Hearth uses semantic versions, starting at `0.1.0`. Package versions and release tags match and have no `v` prefix. During `0.x`, a minor release may change configuration or product behavior; describe any breaking changes in its release notes. The document format version is independent of the package version.

1. Run all checks listed in the README, including the production build and browser suite. Review the screenshot matrix and complete the relevant real-device checks.
2. Update `package.json` and the changelog with the final release version and user-facing changes.
3. Prepare a commit using the `hearth` scope. Obtain confirmation before pushing or publishing.
4. Once authorized, push the commit and create a GitHub release with the matching tag and changelog notes.

The Docker workflow builds `linux/amd64` and `linux/arm64` images and publishes them to `ghcr.io/knowald/ha-hearth` using the repository's `GITHUB_TOKEN`. Release tags produce a version tag and `latest`; manual branch builds produce the branch tag. There is no cross-repository synchronization or external add-on release.

A release is not complete until its image starts successfully with a fresh data directory and the supported document format. Keep the previous image tag and data backups available for recovery.
