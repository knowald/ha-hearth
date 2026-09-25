# Development

## Setup

Requires Node.js 22 or newer and pnpm 10 or newer.

```sh
git clone https://github.com/knowald/ha-hearth.git
cd ha-hearth
pnpm install --frozen-lockfile
cp .env.example .env
# Set HASS_URL in .env
pnpm dev
```

Open the address Vite prints and sign in through Home Assistant. The companion app can use a long-lived access token from your Home Assistant profile instead.

To develop inside Docker, run `just up`, which starts `docker-compose.dev.yml` with `.env.docker`.

## Checks

| Command                  | What it checks                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check`             | Svelte and TypeScript types.                                                                                              |
| `pnpm lint`              | Prettier formatting and ESLint.                                                                                           |
| `pnpm check:boundaries`  | Import direction between layers, see [architecture](architecture.md).                                                     |
| `pnpm check:style`       | Styles use `--h-*` tokens instead of raw values.                                                                          |
| `pnpm check:hearth-a11y` | Accessibility rules for Hearth components.                                                                                |
| `pnpm test`              | Unit and component tests with coverage.                                                                                   |
| `pnpm build`             | Production build.                                                                                                         |
| `pnpm check:bundle`      | Bundle size budget. Run after `pnpm build`.                                                                               |
| `pnpm test:e2e`          | Browser tests with Playwright.                                                                                            |
| `pnpm matrix`            | Screenshots of every scene on phone, portrait and tablet, day and night, written to `matrix-output/` with a review sheet. |

Browser tests and the matrix run against a fake Home Assistant with fixture data. Real devices and live cameras still need testing against a real installation.

## Conventions

- [Component conventions](../src/lib/Hearth/README.md) cover adding cards and widgets, state and styling.
- Commits use the `hearth` scope, for example `fix(hearth): ...`.
- The [changelog](../CHANGELOG.md) follows [Common Changelog](https://common-changelog.org/).
- See [releasing](release.md) for versions and channels.

Contributions are covered by the [MIT license](../LICENSE).
