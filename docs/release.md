# Releasing Hearth

Hearth uses semantic versions, starting at `0.1.0`. Package versions and release tags match and have no `v` prefix. During `0.x`, a minor release may change configuration or product behavior; describe any breaking changes in its release notes. The document format version is independent of the package version.

1. Run all checks listed in [development](development.md#checks), including the production build and browser suite. Review the screenshot matrix and complete the relevant real-device checks.
2. Bump the version in `package.json` and add a matching entry to `CHANGELOG.md` listing the user-facing changes.
3. Prepare a commit using the `hearth` scope. Obtain confirmation before pushing or publishing.
4. Once authorized, push the commit and create a GitHub release with the matching tag and changelog notes.

## Channels

| Channel | Source                 | Image tags             | Add-on        |
| ------- | ---------------------- | ---------------------- | ------------- |
| stable  | GitHub release         | `X.Y.Z`, `latest`      | Hearth        |
| beta    | GitHub prerelease      | `X.Y.Z-beta.N`, `beta` | Hearth (beta) |
| edge    | every push to `master` | `edge`                 | Hearth (edge) |

A beta is a release candidate for the next version. Tag it `X.Y.Z-beta.N`, starting at `1`, set the same version in `package.json`, and publish the GitHub release with "Set as a pre-release" checked. Prereleases get no `CHANGELOG.md` entry; put their notes in the GitHub release body. The stable `X.Y.Z` entry lists every change since the previous stable release. A beta never moves `latest`.

Edge needs no release steps. The edge add-on checks `master` nightly and builds its latest commit once that commit's CI checks have passed.

## Changelog

`CHANGELOG.md` follows [Common Changelog](https://common-changelog.org/). Every stable release gets an entry; there is no Unreleased section.

- Heading: `## [VERSION] - YYYY-MM-DD`, newest first, with a reference link at the bottom of the file: `[VERSION]: https://github.com/knowald/ha-hearth/releases/tag/VERSION`.
- Groups, as third-level headings in this order and only when they have entries: `Changed`, `Added`, `Removed`, `Fixed`.
- Each change is one list item in the imperative ("Fix", "Add", "Show"), readable without its heading, followed by its commit or pull request references: ``([`53bd922`](https://github.com/knowald/ha-hearth/commit/53bd922))`` or `([#16](https://github.com/knowald/ha-hearth/pull/16))`.
- Prefix breaking changes with `**Breaking:**` and list them first in their group. During `0.x` this includes configuration and document format changes.
- Leave out changes users do not see: dotfiles, CI, dev dependencies, test-only and formatting-only changes.

## Publishing

The Docker workflow builds `linux/amd64` and `linux/arm64` images and publishes them to `ghcr.io/knowald/ha-hearth` using the repository's `GITHUB_TOKEN`. Releases and pushes to `master` produce the tags listed under Channels; manual branch builds produce the branch tag. Stable and beta add-on releases are coordinated manually: publish the Hearth tag first, then update `config.yaml` and the changelog (only `beta/config.yaml` for a beta) in `knowald/addon-ha-hearth` to the same version and publish its matching release, marked as a pre-release for a beta. After a stable release, also set `beta/config.yaml` to the stable version so beta users move onto it. The add-on Dockerfile builds the Hearth source tag rather than consuming this image. Confirm both add-on architecture images publish successfully.

A release is not complete until its image starts successfully with a fresh data directory and the supported document format. Keep the previous image tag and data backups available for recovery.
