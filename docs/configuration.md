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

Closing an editor sheet with changes in it (backdrop tap, close button, Escape or back) asks before dropping them, and the browser asks before a reload or a closed tab drops unsaved edits. Moving an item with the arrows in a sheet's header, or a card to another page or column, is one of those changes: it applies on Done.

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

| `screensaver_background` | Behind the clock                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------ |
| unset or `none`          | Plain black.                                                                                           |
| `image`                  | `screensaver_image`, a URL or an uploaded image.                                                       |
| `radar`                  | An animated weather radar map, set up under `screensaver_radar`.                                       |
| `photos`                 | A slideshow of the uploaded images in `screensaver_photos`.                                            |
| `sun`                    | A sky gradient that follows `sun.sun`: deep blue at night, warm at dawn and dusk, light by day.        |
| `media`                  | Album art and the track while a media player plays, `screensaver_media_fallback` the rest of the time. |

The photo frame only shows images uploaded to Hearth, stored in `hearth-images/`. Add them under Photos in the sleep screen settings, several at once if you like. Each photo shows for `screensaver_photo_seconds` (30 when unset, 5 to 86400), in a shuffled order or, with `screensaver_photo_order: sequence`, in the order listed, carrying on where the last sleep stopped. Photos crossfade and slowly zoom; with motion turned off under This screen they change without either.

The sky changes once a minute. The now playing screen follows `screensaver_media_entity`, or any player that is playing when it is unset. A buffering player counts as playing, and the track stays up for 5 seconds after it stops, so skipping to the next song does not flash the fallback. Brightness applies to every background.

```yaml
screensaver_minutes: 10
screensaver_background: media
screensaver_media_entity: media_player.living_room
screensaver_media_fallback: photos
screensaver_photos:
  - hearth-images/3f1c0d9a6b2e4f7a8c5d1e0b9a7f6c3d.webp
  - hearth-images/a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5.webp
screensaver_photo_seconds: 60
screensaver_photo_order: sequence
```

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

## Templates

Templates are Home Assistant Jinja. Home Assistant renders them on the server, over the same websocket connection as everything else, and pushes a new result whenever a state they read changes; Hearth only shows the text. Any user that can sign in to Hearth can render templates this way, so a long-lived token of a non-administrator works too.

Each distinct template is rendered once, however many cards and tiles show it, and only while one of them is on screen. While you type a template in the editor, the preview waits for a short pause before asking Home Assistant, so half-typed templates do not fill its log with errors.

### Template card

A `template` card shows the result as Markdown, cleaned the same way as the Template widget in the sidebar: no scripts, frames, form controls or event handlers. `title` and `icon` are optional. `entities` is an optional list of the entity ids the template reads; Hearth does not parse the template, so this list is what tells the dashboard which entities the card depends on.

```yaml
- id: laundry-note
  type: template
  title: Laundry
  icon: local_laundry_service
  content: |
    **{{ states('sensor.washer_status') | title }}**
    {% if is_state('binary_sensor.washer_door', 'on') %}Door open{% endif %}
  entities:
    - sensor.washer_status
    - binary_sensor.washer_door
```

While the template loads, or when Home Assistant reports an error, the card shows a dash. In edit mode it shows the error instead.

### Templated tile text

Each entity in an entities card takes a `name_template` and a `state_template`. Set them in the entity's options in the entities card editor, or in YAML:

```yaml
entities:
  - entity: sensor.phone_battery
    name_template: "{{ state_attr('device_tracker.phone', 'friendly_name') }}"
    state_template: "{{ states('sensor.phone_battery') }}% {{ 'charging' if is_state('binary_sensor.phone_charging', 'on') else '' }}"
```

The result replaces the tile's name or state text, or a stat box's reading and unit. Until it renders, when it fails, and when it renders blank, the tile shows its normal name and state. The normal state text also comes back while the entity is unavailable and while a light or cover is being dragged or a command is in flight. A stat box's air quality verdict and band still follow the entity's real value, not the template. The rendered name is also the name the tile's details and controls use.

## Visibility conditions

Cards, sidebar widgets and pages take a `visibility` list. Every condition in it has to hold. In edit mode hidden items stay on screen, dimmed, so they can still be edited.

| Condition                                       | Holds when                                                                                                  |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `entity` with `state` or `state_not`            | The entity's state is, or is not, that text. A missing entity never holds.                                  |
| `entity` with `above` and/or `below`            | The state is a number in that range.                                                                        |
| `entity` with `attribute`                       | The same checks, on one attribute of the entity instead of its state.                                       |
| `media`                                         | The CSS media query matches. Not allowed in alert rules.                                                    |
| `device`                                        | This screen's device name (This screen > Device name, or `?device=`) is the name, or one of a list.         |
| `time` with `after`, `before` and/or `weekdays` | The time is from `after` up to `before`, on one of the `weekdays` (`mon` to `sun`). All three are optional. |
| `or`                                            | At least one of the nested conditions holds.                                                                |

Times are `HH:MM` on the 24 hour clock, read in the time zone the clocks show: the first clock widget's, or the browser's. The same time for `after` and `before` is the whole day. A window whose `after` is later than its `before` runs past midnight, and the hours after midnight count as the day the window started: Friday 22:00 to 06:00 still holds at 02:00 on Saturday. Time conditions are checked again every minute. A time condition that cannot be read, such as `after: 7pm`, never holds, and the editor reports it.

```yaml
visibility:
  - device: [kitchen, hallway]
  - time:
      after: '06:00'
      before: '10:00'
      weekdays: [mon, tue, wed, thu, fri]
  - entity: climate.living_room
    attribute: hvac_action
    state: heating
```

A page with `visibility` leaves the nav widget, the phone page strip, search and swiping while its conditions do not hold. A page that becomes hidden while it is on screen stays there until you leave it, and so does a hidden page that edit mode ends on. A `?room=` link to a hidden page opens the first page shown instead, and a `navigate` tap action or HEARTH event does nothing for a hidden page. When every page is hidden the first page stays. Set it under Conditions in the page editor.

## Style rules

An entity in an entities card takes a `style` list. The first rule whose `conditions` hold restyles the tile; the others are skipped. Conditions are the same as for visibility, except that media queries are not allowed. Each rule sets at least one of:

- `color`: `accent`, `cool`, `good`, `bad`, or a CSS color such as `#e53935`. It colors the icon and the outline of a tile, and the value of a stat box.
- `icon`: replaces the tile's icon.
- `class`: one or more class names, added to the element around the tile for custom CSS. Names Hearth uses itself, such as `tile`, `styled`, `entity-slot`, `pressable`, `hidden` or `editing`, are refused; an unusable class is dropped and the rest of the rule kept.

```yaml
entities:
  - entity: lock.front_door
    style:
      - conditions:
          - entity: lock.front_door
            state: unlocked
        color: bad
        icon: lock_open
        class: front-door-open
```

Edit them under Style rules in an entity's options in the entities card editor.

## To-do list card

The `todo` card shows a Home Assistant to-do list, such as Shopping List, Local To-do or Google Tasks. Tick an item to complete it, type in the field at the top and press Enter to add one, tap an item's text to rename it and long-press an item (or press Delete on it) to remove it after a confirmation. Changes show at once and roll back if Home Assistant refuses them.

```yaml
- id: shopping
  type: todo
  entity: todo.shopping_list
  title: Shopping
  sort: due
  show_completed: true
```

| Key              | Effect                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------- |
| `entity`         | The `todo.*` list. Required.                                                                        |
| `title`          | Heading. Defaults to the list's name.                                                               |
| `sort`           | `manual` keeps the list's own order (the default), `alphabetical` sorts by name, `due` by due date. |
| `show_completed` | `true` opens the Completed section. Without it, completed items wait in a collapsed section.        |
| `hide_add`       | `true` hides the add field.                                                                         |

The card offers only what the list's integration supports: no add field on a list that cannot create items, no checkbox or rename where items cannot be updated, and no delete or Clear completed where they cannot be removed. Due dates show as a chip and turn red once overdue. Items arrive through `todo/item/subscribe`; on Home Assistant versions without it the card asks `todo.get_items` instead. A list that is missing or unavailable shows as List unavailable. Items an integration sends without an id are changed by their text, and are read-only when two of them share it. In edit mode a tap on the list opens the card editor.

## Sharing cards and themes

The card and widget sheets have a Form and a YAML view. YAML shows the item as it is saved, id included, and takes every option, also ones the form has no field for, such as `verdict` bands on an entity or a temperature card. It is checked like `hearth.yaml`: while it has an issue, Done and the way back to the form stay disabled and the issue names the line. The id of an existing item cannot change here. Comments are not kept, and anchors, aliases (`*name`) and merge keys (`<<`) are refused; write the values out.

Copy as YAML, in the sheet's footer, puts the item on the clipboard. Add card and Add widget take it back under Paste YAML: one item, or a list of them, each with a new id. A Lovelace card pastes only where it is already a valid Hearth card; nothing is converted. Over plain HTTP on the LAN the browser keeps the clipboard from Hearth, so Copy shows the text selected for copying by hand, and Paste takes text pasted into its box.

```yaml
- type: entities
  title: Air
  style: stat
  entities:
    - entity: sensor.living_room_co2
      verdict:
        good: 800
        fair: 1200
- type: iframe
  url: https://example.com/weather
  height: 240
```

Under Theme > Share, Copy as YAML and Download write the open theme (day or night) in the format of a saved theme in `hearth-themes/`. Import takes such a file, or a bare mapping of theme tokens, shows a preview, and applies it on Apply as a step you can undo. Keys that are not theme tokens are left out and listed. Each value must be one CSS value: no `;` outside brackets, no comments, backslashes or braces, and a hex colour for `accent`, `cool`, `bad`, `surface` and `line`, where a short `#f80` is kept as `#ff8800`. The YAML editor and saving check `hearth.yaml` the same way. When `hearth.yaml` is loaded, a value that fails this check is skipped and its token keeps the default. An imported `background_image` must be `none` or point at an uploaded image, a path on the Hearth host or a `data:image` URL, never another host.

```yaml
name: Moss
theme:
  accent: '#3a7d44'
  cool: '#4a90a4'
```

## Custom CSS and JavaScript

Edit custom CSS under Settings > Appearance > Custom CSS. Save writes the file at once and returns to Settings. Style against the `--h-*` tokens, not internal class names, which can change between releases.

Tiles and stat boxes carry `data-entity` (the entity id), `data-domain` and `data-state` (the raw Home Assistant state), and each page carries `data-page` with its id. These follow the live state, so custom CSS can react to it:

```css
[data-domain='lock'][data-state='unlocked'] {
	border-color: rgb(var(--h-bad-rgb));
}

[data-page='cameras'] [data-entity='binary_sensor.doorbell'][data-state='on'] {
	background: rgb(var(--h-accent-rgb) / calc(0.2 * var(--h-accent-scale)));
}
```

For custom JavaScript, edit `custom_javascript.js` in the data directory and turn on Custom JavaScript in Server settings. It runs on every page load.

## Touch feedback

Touch feedback is off by default. When on, the device vibrates on presses, long presses, slider steps, saves and failed commands.

It needs the Vibration API and a secure origin:

- Chrome on Android works over HTTPS or `localhost`. Over plain HTTP, the setting reports no vibration support.
- Firefox for Android does not provide the API.
- iOS Safari has no Vibration API. On iOS 18 and newer, Hearth toggles a hidden switch control, which makes Safari play its haptic tick. Safari only honors it during the tap itself, so feedback that arrives later, such as a failed command, may stay silent.
