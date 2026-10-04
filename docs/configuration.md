# Configuration

Most configuration happens in the editor. This page covers the files behind it, the server environment, URL options and a few browser-specific notes.

## Data directory

Hearth stores everything in one data directory. The Node server uses `./data` under the directory it starts from. The container uses `/app/data`, which Docker Compose mounts from `DATA_PATH` (default `./data`). The Home Assistant app uses its own volume.

| Path                   | Contents                                                                                                                    |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `hearth.yaml`          | Pages, cards, sidebar widgets, themes, sleep screen and layout settings, and alert rules.                                   |
| `configuration.yaml`   | Server settings: default language, reduce motion, touch feedback, long-lived access token and the custom JavaScript switch. |
| `custom_css.css`       | Custom CSS, edited under Settings > Appearance > Custom CSS.                                                                |
| `custom_javascript.js` | Custom JavaScript. Edit the file directly; it runs on every page load when Custom JavaScript is on in Server settings.      |
| `hearth-themes/`       | Saved theme presets.                                                                                                        |
| `hearth-images/`       | Images uploaded for header cards, theme backgrounds and the sleep screen.                                                   |
| `backups/`             | Earlier versions of `hearth.yaml` and `configuration.yaml`, the ten most recent of each.                                    |

Keep this directory private. `configuration.yaml` may hold a Home Assistant access token.

### Document version

`hearth.yaml` must declare `version: 5`. A file with another version is not converted: Hearth shows a load error and locks editing so the file is not overwritten. Update Hearth, or restore a matching copy from `backups/`, then reload.

### Saving

Every save carries the revision the browser loaded. If another browser saved in the meantime, the edit bar reports the conflict and offers to copy your edits, overwrite the newer version or reload. The previous content goes to `backups/` before the file is replaced. Entering edit mode checks for a newer revision first and offers to reload before you edit an old one.

Closing an editor sheet with changes in it (backdrop tap, close button, Escape or back) asks before dropping them, and the browser asks before a reload or a closed tab drops unsaved edits.

Fields marked with `*` are required. Until they are filled, Done stays disabled and the reason is shown under it. An entity field shows the entity's name and state, and warns (without blocking) when Home Assistant does not report the entity or it belongs to another domain. List rows without an entity are removed on save. The entity picker also searches area and device names, filters by area, lists your recent picks first (and, for a page's temperature and humidity sensors, the fitting sensors first), and in list editors (Pick several entities) adds several entities at once.

To go back, open Settings > Versions, compare an earlier version with the open dashboard and restore it as an edit you can still undo.

### Images

Hearth scales uploaded images to at most 2560 px on the long edge and re-encodes them in the browser, which also removes photo location data. GIFs are stored unchanged. Files go to `hearth-images/` and are referenced as `hearth-images/<file>`. The server accepts PNG, JPEG, GIF, WebP and AVIF up to 15 MB.

## Environment variables

| Variable          | Default | Purpose                                                                                         |
| ----------------- | ------- | ----------------------------------------------------------------------------------------------- |
| `HASS_URL`        | none    | Home Assistant URL the server proxies to. Required.                                             |
| `HASS_PUBLIC_URL` | unset   | Home Assistant URL the browser uses for sign-in and the WebSocket, when `HASS_URL` is internal. |
| `PORT`            | `5050`  | Port the Node server listens on.                                                                |
| `BODY_SIZE_LIMIT` | `16M`   | Maximum request size, which bounds image uploads.                                               |

The browser connects to Home Assistant directly. Which URL it uses depends on how Hearth is reached:

- Through Ingress: the Home Assistant address the browser is already on.
- Directly: `HASS_PUBLIC_URL` when set, otherwise `HASS_URL`.

When Hearth is served over HTTPS, `HASS_PUBLIC_URL` must be HTTPS too. Browsers block plain HTTP connections from an HTTPS page.

Docker Compose passes `HASS_URL`, `HASS_PUBLIC_URL` and `TZ` from `.env.docker` to the container. `EXPOSED_PORT` sets the host port and `DATA_PATH` the data folder. See `.env.docker.example`.

The Home Assistant app sets `HASS_URL` itself. For direct-port access, set its Home Assistant URL for direct access option (`hass_public_url`) instead of `HASS_PUBLIC_URL`.

## URL options

| Option            | Effect                                                                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `?room=<id>`      | Open the page with this id. Hearth keeps the current page in the address, so copy it from there.                                          |
| `?theme=<preset>` | Show a built-in theme without saving it: `hearth`, `paper`, `slate`, `void`, `glass`, `forest`, `plum` or `muted`. Ignored while editing. |
| `?menu=false`     | Hide the Edit Hearth configuration and This screen buttons, for wall tablets. See [This screen](#this-screen) for the way back in.        |
| `?device=<name>`  | Name this screen, so [alerts](alerts.md#home-assistant-events) can target it.                                                             |

These change presentation only. They are not access controls.

## Settings

The Settings sheet in edit mode groups its rows by where they are kept. Each section says so under its title:

- Every screen, saved with the dashboard: Appearance, Layout and navigation, Size and spacing, Wall display, Alerts and Pages. These go to `hearth.yaml` when you choose Save in the edit bar. Cancel drops them.
- Every screen, saved now: Server settings, which writes `configuration.yaml` with its own Save button.
- This browser only: This screen, below.

## This screen

Some settings belong to one screen rather than to every screen that opens the dashboard. A phone should not hold a wake lock or show the wall tablet's sleep screen, and a tablet across the room may want a larger scale.

The This screen sheet keeps these per browser, in local storage:

- Device name, which [alerts](alerts.md#home-assistant-events) use to target a screen.
- Keep screen awake.
- Sleep screen turns on, including Off.
- Interface scale, and the scale at 900 px and narrower.
- Language, reduce motion and touch feedback.
- Log out, which clears the Home Assistant session in this browser.

Each row starts at Same as dashboard and follows the shared value from `hearth.yaml` or `configuration.yaml` until you pick another one. A shared row that this screen overrides says so in the Settings sheet. A scale picked here also applies at 900 px and narrower unless that row has a value of its own. Clearing site data, or a kiosk browser that wipes storage, returns the screen to the shared values.

Open the sheet with the button next to Edit Hearth configuration. It does not need edit mode. With `?menu=false` both buttons are hidden; press and hold the bottom-left corner of the screen for 2 seconds instead. The corner works only with `?menu=false`, since the buttons sit there otherwise.

## Edit lock

A wall tablet takes stray taps. Settings > Wall display > Edit lock makes the edit button harder to hit by accident:

| `edit_lock` | Effect                                                |
| ----------- | ----------------------------------------------------- |
| unset       | A tap opens edit mode.                                |
| `hold`      | The button has to be pressed and held for 2 seconds.  |
| `pin`       | The button asks for `edit_pin`, 4 to 8 digits, first. |

```yaml
edit_lock: pin
edit_pin: '0815'
```

Quote the PIN in YAML. Unquoted, YAML reads it as a number and drops any leading zero, so Hearth reports an unquoted PIN as an error. A `pin` lock without a valid `edit_pin` asks for a hold instead.

With `hold`, a tap only shows "Hold for 2 seconds to edit". Keep a finger or the mouse button down on the edit button until the bar along its foot fills. Holding Enter or Space works too.

This protects against accidents, not people. The PIN is sent to every browser with the rest of the dashboard, and anyone who can reach Hearth can still change `hearth.yaml`. See the security note in the README.

## Sleep screen

Settings > Wall display > Sleep screen turns it on after a set number of minutes and sets its background. A screen can turn it off, or use another delay, under This screen. It does not come on in edit mode; the minutes count again from when editing ends. The weather radar background loads radar images from RainViewer and map tiles from OpenStreetMap in the browser, so the screen needs internet access for it. Set Map tiles to use another tile server.

## Phone page strip

On phones, and on any screen with the sidebar set to None, page buttons run along the top of the page. Settings > Layout and navigation > Clock in the phone page strip adds the time and a short date at the start of that strip, for small screens that have no room for a clock widget. In YAML it is `phone_clock: true`. It uses the time zone and hour format of the first clock widget in the sidebar, or the browser's when there is none.

## Interface scale and padding

Settings > Size and spacing sets the interface scale (`scale` in `hearth.yaml`, 50 to 200 percent) and the side and top/bottom padding (`padding_x`, `padding_y`). The rows under Screens 900 px and narrower (`mobile_scale`, `mobile_padding_x`, `mobile_padding_y`) apply at 900 px wide and below. While one of them is unset, those screens use the main value. A screen can override both scales under This screen.

The scale is a CSS `zoom` on the page and needs Chromium 128 or Firefox 126. Older browsers stay at 100%, and Settings says so. Layout breakpoints follow the physical screen, not the scaled one, so a large scale on a narrow tablet keeps the wide layout in less room.

## Tap and hold actions

Each entity in an entities card, as a tile or a stat box, and the status widget take a `tap_action` and a `hold_action`. Without them a tile does what its domain does: a switch toggles, a lock asks before it unlocks, a sensor opens its history and a hold opens the controls. Set them in the editor under Tap and Hold, in an entity's options in the entities card or on the status widget, or in YAML:

| `action`         | Effect                                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `default`        | What the tile does on its own. Same as leaving the action out.                                                                              |
| `toggle`         | Toggles the entity, or the one named in `entity`. Locks and garage doors still ask first.                                                   |
| `more-info`      | Opens the entity's details, or those of the one named in `entity`.                                                                          |
| `perform-action` | Calls `perform_action`, a `domain.service`, with `target` and `data`.                                                                       |
| `navigate`       | Goes to the page in `navigation_path`: a page id, a page name, or a Lovelace path such as `/lovelace/kitchen` whose last part is a page id. |
| `url`            | Opens `url_path` in a new tab. Only http(s) addresses and paths on the Hearth host, such as `/local/page.html`.                             |
| `none`           | Does nothing. With `hold_action: none`, a long press counts as a tap.                                                                       |

Any action can ask first: `confirmation: true` asks "Are you sure?", and `confirmation: { text: Lock up for the night? }` asks that instead. Where an unlock or a moving garage door asks anyway, Hearth asks once, not twice.

```yaml
entities:
  - entity: switch.coffee_machine
    tap_action:
      action: perform-action
      perform_action: script.turn_on
      target:
        entity_id: script.morning_coffee
      data:
        variables:
          cups: 2
      confirmation:
        text: Start the coffee?
    hold_action:
      action: navigate
      navigation_path: kitchen
```

The keys are the ones Home Assistant's dashboards use, so an action copied from a Lovelace card works as it is. The older spelling still reads: `call-service`, `service` and `service_data` become `perform-action`, `perform_action` and `data`, and Hearth saves the new spelling. This one, pasted from a Lovelace button card, runs the script on tap:

```yaml
- entity: script.goodnight
  tap_action:
    action: call-service
    service: script.turn_on
    service_data:
      entity_id: script.goodnight
    confirmation:
      text: Good night?
```

Hearth has no `double_tap_action` and ignores it. Other Lovelace action types, such as `assist` or `fire-dom-event`, are reported as errors. In edit mode a tap opens the tile's editor and no action runs.

A display-only tile, set on the entity or inherited from the card, sends no command from a configured action either: `toggle` and `perform-action` do nothing there. `navigate`, `more-info` and `url` still run, so a read-only tile can still lead somewhere.

The status widget takes actions only with text or an entity. Without either it lists open problems and has no pill to tap, so the editor hides Tap and Hold and YAML that sets them is reported.

On a touch screen a configured hold action runs when the finger lifts; the vibration still comes at the hold. A browser opens a new tab only from the lift, so this keeps `url` holds working.

The search overlay works as a small command palette for scenes and scripts: each one gets a Run button, and Enter runs the highlighted one. Tapping the row still opens its details.

## Custom CSS and JavaScript

Edit custom CSS under Settings > Appearance > Custom CSS. Save writes the file at once and returns to Settings. Style against the `--h-*` tokens, not internal class names, which can change between releases.

For custom JavaScript, edit `custom_javascript.js` in the data directory and turn on Custom JavaScript in Server settings. It runs on every page load.

## Touch feedback

Touch feedback is off by default. When on, the device vibrates on presses, long presses, slider steps, saves and failed commands.

It needs the Vibration API and a secure origin:

- Chrome on Android works over HTTPS or `localhost`. Over plain HTTP, the setting reports no vibration support.
- Firefox for Android does not provide the API.
- iOS Safari has no Vibration API. On iOS 18 and newer, Hearth toggles a hidden switch control, which makes Safari play its haptic tick. Safari only honors it during the tap itself, so feedback that arrives later, such as a failed command, may stay silent.
