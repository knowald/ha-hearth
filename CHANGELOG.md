# Changelog

## 0.1.2

- Fix Home Assistant login through Nabu Casa Ingress by using the forwarded HA origin and an explicit Ingress OAuth redirect URL, matching Fusion.

## 0.1.1

- Fix Home Assistant login through HTTPS Ingress and Nabu Casa by using the browser's Home Assistant origin.
- Add `HASS_PUBLIC_URL` for direct access when the server uses an internal Home Assistant address.
- Recover from expired or consumed login codes and preserve room, theme and kiosk settings after login.
- Fix the CodeMirror dependency so the configuration editor and type checks use the supported editor API.

## 0.1.0

- Add frosted glass surfaces: a backdrop blur knob for every card, tile and widget, a scrim over the background image and an inherited text shadow.
- Blur the edges where a scroll container cuts content off, on the page column, the editor sheet and the media shortcut row. Off-switch in Settings for slower screens.
- Float the theme editor over the dashboard as a draggable window so edits preview live against the real layout.
- Replace the browser's native colour input with an in-app picker: saturation square, hue strip, theme swatches and a hex field.
- Make the text ladder adjustable: contrast and shadow scales, plus muted-text and icon colours that no longer have to be derived from the ink.
- Keep the standard `backdrop-filter` in the built stylesheet. Writing the `-webkit-` prefix by hand made the minifier drop the unprefixed declaration, which current Chrome ignores, so every blur in the application was doing nothing.
- Add a Void (OLED) color theme preset with a true-black background.
- Establish Hearth as an independent dashboard with its own package, assets and Docker publishing target.
- Remove the retired dashboard, embedded objects, picture-elements tooling, alternate routes and cross-repository release automation.
- Replace camera playback and token login with Hearth components.
- Separate configuration definitions from rendering components so server and editor validation share the same schemas.
- Require revisioned configuration saves and reject unsupported persisted document formats.
- Establish semantic versioning from `0.1.0`.
