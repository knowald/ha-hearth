# Configuration

Most configuration happens in the editor. This page covers the files behind it, the server environment and a few options that are not in the interface.

## Data directory

Hearth stores everything in one data directory: `./data` for Node and Docker Compose (`DATA_PATH` changes it), `/app/data` inside the container, and the add-on's own volume.

| Path                 | Contents                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------- |
| `hearth.yaml`        | Pages, cards, rail widgets, themes and tablet settings.                                   |
| `configuration.yaml` | Language, motion, touch feedback, optional access token and the custom JavaScript switch. |
| `hearth-themes/`     | Saved theme presets.                                                                      |
| `hearth-images/`     | Images uploaded for header cards and theme backgrounds.                                   |
| `backups/`           | The ten most recent revisions of each saved document.                                     |

Keep this directory private. `configuration.yaml` may hold a Home Assistant access token.

### Document version

`hearth.yaml` declares `version: 5`. Hearth rejects other versions with a load error instead of converting them, and locks editing so the file is not overwritten. Fix or restore the file, then reload.

### Saving

Every save carries the revision the browser loaded. If another browser saved in the meantime, the edit bar reports the conflict and offers to copy your edits, overwrite the newer version or reload. The previous content goes to `backups/` before the file is replaced.

### Images

Uploaded images are scaled to at most 2560 px and re-encoded in the browser, then stored in `hearth-images/` and referenced from `hearth.yaml` as `hearth-images/<file>`. The server accepts PNG, JPEG, GIF, WebP and AVIF up to 15 MB.

## Environment variables

| Variable          | Default | Purpose                                                                                         |
| ----------------- | ------- | ----------------------------------------------------------------------------------------------- |
| `HASS_URL`        | none    | Home Assistant URL the server proxies to. Required.                                             |
| `HASS_PUBLIC_URL` | unset   | Home Assistant URL the browser uses for sign-in and the WebSocket, when `HASS_URL` is internal. |
| `PORT`            | `5050`  | Port the Node server listens on.                                                                |
| `BODY_SIZE_LIMIT` | `16M`   | Maximum request size, which bounds image uploads.                                               |

The browser connects to Home Assistant directly. Which URL it uses depends on how Hearth is reached:

- Through Ingress: the Home Assistant origin the browser is already on, taken from `X-Forwarded-Proto` and `X-Forwarded-Host`.
- Directly: `HASS_PUBLIC_URL` when set, otherwise `HASS_URL`.

Use an HTTPS `HASS_PUBLIC_URL` when Hearth itself is served over HTTPS, or the browser blocks the connection.

Docker Compose reads the same variables from `.env.docker`, plus `EXPOSED_PORT`, `DATA_PATH` and `TZ`. See `.env.docker.example`.

## URL options

| Option            | Effect                                  |
| ----------------- | --------------------------------------- |
| `?room=<id>`      | Open a specific page.                   |
| `?theme=<preset>` | Preview a built-in theme.               |
| `?menu=false`     | Hide the edit button, for wall tablets. |

These change presentation only. They are not access controls.

## Custom CSS and JavaScript

Custom CSS and opt-in JavaScript are set in the application settings. Style against the `--h-*` tokens rather than internal class names, which can change between releases.

## Touch feedback

Touch feedback is off by default. When on, the device vibrates on presses, long presses, slider steps, saves and failed commands.

It needs the Vibration API and a secure origin:

- Chrome on Android works over HTTPS or `localhost`. Over plain HTTP it does nothing, even though the browser reports success.
- Firefox for Android does not provide the API.
- iOS Safari 18 has no Vibration API. Hearth uses a switch toggle instead, which Safari only honors during the tap that triggered it.

## Not supported yet

Picture-elements editing, calendar editing, todo editing and GPS maps. Entity domains without dedicated controls open a generic sheet with state, attributes and history.
