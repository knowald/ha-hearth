# Changelog

## [0.7.0] - 2026-10-04

### Changed

- Regroup Settings into Appearance, Layout and navigation, Size and spacing, Wall display, Alerts, Pages, Server and Maintenance, each saying which screens it applies to; Application settings is now Server settings ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Mark advanced options in the card and widget editors and fold them away until used ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Load the editing tools only when edit mode opens, which makes the dashboard's startup code about 15 percent smaller ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Theme values are applied through the browser's style API, so a value can only set its own token. A value that could not stay inside its token now falls back to that token's default when hearth.yaml loads, and is refused on import and in the YAML editor with its line number, and on save ([#31](https://github.com/knowald/ha-hearth/pull/31))
- A short hex colour such as `#f80` now works for the accent, cool, bad, surface and line colours, in hearth.yaml, a theme import and the YAML editor, and is stored as `#ff8800` ([#31](https://github.com/knowald/ha-hearth/pull/31))
- A media query inside an `or` group of a card or widget's visibility conditions now matches the screen; before, only media queries at the top level of the list were read and nested ones never held ([#31](https://github.com/knowald/ha-hearth/pull/31))

### Added

- Translate Hearth into every language Home Assistant ships, 64 besides English, following the language set in Home Assistant or per screen ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Ask before an edit sheet, the YAML editor or Versions drops unsaved changes on a backdrop tap, Escape, the back gesture or close, and before a reload leaves unsaved edits ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Offer to reload when another screen saved a newer configuration before editing starts ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Keep settings per screen in This screen, without edit mode: keep awake, sleep screen delay, scale, language, reduced motion, touch feedback and the device name ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Guard the edit button against stray taps with `edit_lock: hold` or a PIN with `edit_lock: pin` ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Tap a card, stack or widget in edit mode to open its editor ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Duplicate cards, stacks, widgets and pages, move a card to another page or column, and remove a stack with its cards ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Remove a card or widget at once with an Undo button in the toast, and see a dot on Save while there are unsaved changes ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Add pages from the phone page strip in edit mode and reorder them under Settings > Pages ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Mark required fields in the editors, say why Done is disabled and warn about entities Home Assistant does not report ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Search the entity picker by area and device, filter it by area, pick several entities at once and see recent picks first ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Set tap and hold actions on tiles and the status widget with Lovelace's names: toggle, more-info, perform-action, navigate, url or none, with an optional confirmation ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Run scenes and scripts from search ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Let Home Assistant automations switch the page, wake the screen or start the sleep screen through the `HEARTH` event ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Show or hide pages with visibility conditions, and match conditions on the device name, a time window and weekdays, or an entity attribute ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Restyle tiles with `style` rules: a colour, icon or class while conditions hold, and read `data-entity`, `data-domain` and `data-state` from custom CSS ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Render Home Assistant templates in a template card, and in a tile's name or state with `name_template` and `state_template` ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Show a to-do list card for `todo.*` entities: add, tick off, rename and delete items ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Show a slideshow of uploaded photos on the sleep screen, with a slow zoom and crossfade, in shuffled or listed order ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Fill the sleep screen with a sky gradient that follows the sun, deep blue at night, warm at dawn and dusk and light by day ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Show the playing track with its album art on the sleep screen, and a chosen background while nothing plays ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Edit a single card or widget as YAML from its sheet with a Form | YAML switch, which also takes options the form has no field for ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Copy a card or widget as YAML and paste it onto another page or into the sidebar; a pasted item gets a new id ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Share a theme: copy or download it as YAML, and import one from text, the clipboard or a file ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Animate tile icons with their entity: a running fan spins faster at a higher speed, a cleaning vacuum sways, a playing media player shows level bars, a heating or cooling climate entity pulses and a light that is on glows in its color. Turn them off in Settings > Appearance; reduced motion always stops them ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Play a short synthesized chime when an alert fires, chosen per rule or per severity with a volume, off by default; a screen can mute them under This screen ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Greet people on the page header and the sleep screen for a while after they come home, with a greeting for the time of day ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Show a badge on the energy widget while today's use is below the average of the previous 7 days over the same hours ([#31](https://github.com/knowald/ha-hearth/pull/31))
- End the setup with the wall tablet's address and a QR code for it, with an optional device name added as `?device=` ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Start from a starter layout for a kitchen tablet, a phone remote or a bedside screen, built from your own entities ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Add only the entities an area's page does not show yet when importing areas again, without touching the rest of the page ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Suggest the cards of its area on an empty page named after one, each added with one tap ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Star entities in their popup to get a favorites page on your phone, kept in that browser ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Winter, Spring meadow, Autumn and Holiday theme presets ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Switch the day theme by date range or by conditions with `theme_schedule`, for example Winter from December to February or Holiday while a helper is on, with an optional night theme per entry; edit it under Theme > Schedule ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Give a page its own theme and background image, with a shade over the image, shown while the page is open; set it under Look in the page editor ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Let a card span two or three columns, or the full width, on pages with more than one column with `span`; phones and edit mode keep it in its column ([#31](https://github.com/knowald/ha-hearth/pull/31))

### Fixed

- Stop a tap that closes a sheet from also tapping what sits underneath it ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Wait with a Home Assistant refresh event and the sleep screen until edit mode ends ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Reload reliably from the newer configuration, conflict and log out prompts; before, the page could stay as it was ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Clear an old save failure or conflict message when an edit session starts ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Give editor controls finger-sized touch targets at every interface scale, readable hint contrast, names for icon buttons and a 16 px input text size that stops iOS zooming ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Follow a reduced motion change at once, and drag tiles and cards reliably by touch, also on iPad ([#31](https://github.com/knowald/ha-hearth/pull/31))

## [0.6.0] - 2026-10-03

### Added

- Scale the whole interface from 50 to 200 percent in Settings > Display, with a separate scale for phone-width screens ([#27](https://github.com/knowald/ha-hearth/pull/27))
- Set separate side and top/bottom padding for phone-width screens ([#27](https://github.com/knowald/ha-hearth/pull/27))
- Show a small clock with the date at the start of the phone page strip, following the sidebar clock's time zone and hour format ([#28](https://github.com/knowald/ha-hearth/pull/28))
- Highlight an entity tile from another entity or a list of states while it keeps showing its own state, for example a washer tile lit while its status sensor reads `running` ([#20](https://github.com/knowald/ha-hearth/pull/20), [#29](https://github.com/knowald/ha-hearth/pull/29))

## [0.5.1] - 2026-09-29

### Fixed

- Stack the media popup's queue under the player on phones, so the title, progress bar and playback buttons get the full width ([#19](https://github.com/knowald/ha-hearth/pull/19))
- Keep a card's column count to at most two on phones, and show one tile per row while editing there ([#19](https://github.com/knowald/ha-hearth/pull/19))
- Stop a vertical drag or a second finger on a light or blind tile from toggling it or opening its popup ([#19](https://github.com/knowald/ha-hearth/pull/19))
- Set the value where you tap on a popup slider, and ignore right and middle clicks on sliders ([#19](https://github.com/knowald/ha-hearth/pull/19))
- Allow pinch zoom to start on light and blind tiles ([#19](https://github.com/knowald/ha-hearth/pull/19))
- Keep edit sheets, the entity picker, toasts, the edit button and the wide layout clear of the notch and the home indicator ([#19](https://github.com/knowald/ha-hearth/pull/19))
- Stop iOS zooming in when a text field in the editor or search gets focus ([#19](https://github.com/knowald/ha-hearth/pull/19))
- Truncate long edit sheet titles instead of pushing the close button off screen ([#19](https://github.com/knowald/ha-hearth/pull/19))
- Keep toasts and the last widget clear of the edit bar when it wraps onto two rows ([#19](https://github.com/knowald/ha-hearth/pull/19))
- Give drag handles, progress bars and volume bars a finger-sized touch area ([#19](https://github.com/knowald/ha-hearth/pull/19))
- Shrink search and edit sheets with the on-screen keyboard on Android ([#19](https://github.com/knowald/ha-hearth/pull/19))

## [0.5.0] - 2026-09-28

### Changed

- Show the notifications widget as one button with a count badge and the newest title, opening a list of alerts and Home Assistant notifications ([`2f6f489`](https://github.com/knowald/ha-hearth/commit/2f6f489))
- Group the screensaver settings in their own Sleep screen section, with a button to preview it ([`2a5d6dd`](https://github.com/knowald/ha-hearth/commit/2a5d6dd))
- Stop showing the https note under touch feedback in App settings ([`bbf9636`](https://github.com/knowald/ha-hearth/commit/bbf9636))

### Added

- Place the sidebar on the left, on the right, on both sides or hide it, and pick a side for each widget when there are two ([`80deda2`](https://github.com/knowald/ha-hearth/commit/80deda2))
- Swipe sideways between pages, on phones and on wider screens where a mouse drag works like a finger, each with its own setting ([`9c54527`](https://github.com/knowald/ha-hearth/commit/9c54527))
- Raise alerts from dashboard rules, such as a fridge door left open for two minutes, and close them again when the condition clears ([`2f6f489`](https://github.com/knowald/ha-hearth/commit/2f6f489))
- Raise, dismiss and target alerts from Home Assistant automations through the `HEARTH` event, and open or close an entity popup the same way ([`2f6f489`](https://github.com/knowald/ha-hearth/commit/2f6f489))
- Name each screen in App settings or with `?device=`, so an automation can send an alert to one screen ([`2f6f489`](https://github.com/knowald/ha-hearth/commit/2f6f489))
- Wake the sleep screen when an alert pops up, and keep it awake while the alert shows ([`2f6f489`](https://github.com/knowald/ha-hearth/commit/2f6f489))
- Show an image or a live weather radar map of the home location, or any other location, behind the sleep screen clock ([`2a5d6dd`](https://github.com/knowald/ha-hearth/commit/2a5d6dd))
- Set the sleep screen clock size, show or hide the date, and show the current weather under the clock ([`2a5d6dd`](https://github.com/knowald/ha-hearth/commit/2a5d6dd))

### Fixed

- Stop the browser's own grey tap highlight, long-press menu and hover state that stayed on after a tap on touch screens, leaving only Hearth's press feedback ([`4ed7ae9`](https://github.com/knowald/ha-hearth/commit/4ed7ae9))

## [0.4.0] - 2026-09-26

### Added

- Embed a web page as a card on any page, such as the Music Assistant interface, filling its column unless a height is set ([`e2b1748`](https://github.com/knowald/ha-hearth/commit/e2b1748))
- Set a background image on header cards and the theme, from a URL or an image uploaded to Hearth, and manage uploaded images from the image field ([`6324403`](https://github.com/knowald/ha-hearth/commit/6324403))

### Fixed

- Play WebRTC-only cameras, such as Ring live view, instead of requesting an HLS stream they reject; Hearth now asks Home Assistant which stream types a camera supports and falls back to HLS when WebRTC fails on a camera that offers both ([`19b4bd7`](https://github.com/knowald/ha-hearth/commit/19b4bd7), [`756c09d`](https://github.com/knowald/ha-hearth/commit/756c09d))
- Keep showing the snapshot of a camera that has no live stream instead of offering a Retry that cannot work ([`75799d8`](https://github.com/knowald/ha-hearth/commit/75799d8))
- Load behind an nginx reverse proxy in front of Home Assistant, which rejected the page with a 502 because its preload `Link` header exceeded the default 4k proxy buffer ([`c9eee00`](https://github.com/knowald/ha-hearth/commit/c9eee00))

## [0.3.0] - 2026-09-23

### Changed

- Show why the connection fails on the boot screen after a few attempts, with a hint for the cause and a Retry button, instead of spinning forever ([`23f870f`](https://github.com/knowald/ha-hearth/commit/23f870f))
- Keep the sign-in sheet open until Home Assistant accepts the token, say so when it rejects one, and call the action "Sign in" everywhere ([`23f870f`](https://github.com/knowald/ha-hearth/commit/23f870f))
- Explain an unreadable, invalid or unsupported `hearth.yaml` and an unreadable `configuration.yaml` in the load-error banner, with a Reload button ([`f205c5b`](https://github.com/knowald/ha-hearth/commit/f205c5b))
- Tell a degraded Home Assistant connection, where some data may be stale, apart from a lost one ([`f205c5b`](https://github.com/knowald/ha-hearth/commit/f205c5b))
- Keep the first-run area import open on a stray backdrop tap and offer Skip for now ([`f205c5b`](https://github.com/knowald/ha-hearth/commit/f205c5b))
- Move the area import from the edit bar to the Settings sheet, and offer it on an empty home page until the dashboard is set up ([`f205c5b`](https://github.com/knowald/ha-hearth/commit/f205c5b), [`153a411`](https://github.com/knowald/ha-hearth/commit/153a411))
- Open the same detail sheet for an entity from every tile, search result and widget, headed by its translated domain name and configured icon ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Send a cleaning or returning vacuum home from every surface, and offer the same actions in its detail sheet and popover ([`15a5e62`](https://github.com/knowald/ha-hearth/commit/15a5e62), [`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Ask before unlocking or opening a lock but not before locking it, on the tile and in the detail sheet alike ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Label each editor sheet's header action by what it does: Close, Done, Apply or Save ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Confirm destructive editor actions with the same dialog everywhere, including leaving edit mode with unsaved changes, and stop asking before a stack is unwrapped ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Share one visibility section and one live preview between the card and widget editors ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Show whole readings without a decimal ("21" rather than "21.0") and use the Home Assistant temperature unit on every surface ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Build a page list into a wide rail that has no visible navigation widget, so pages can always be changed ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4), [`bea0e74`](https://github.com/knowald/ha-hearth/commit/bea0e74))
- Close the top popup, sheet or search with the browser or Android back button, and keep the current page in `?room=` ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Show search as a full-width sheet on phones ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Let only the edit chip react on rail widgets while editing ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Hide rail widgets with nothing to show, show "-" for an unavailable entity instead of a made-up reading, and keep a dimmed placeholder while editing ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Stop all motion, including the pending pulse and the press scale, when reduced motion is set in Hearth or the operating system ([`ede2b06`](https://github.com/knowald/ha-hearth/commit/ede2b06))
- Draw shadows, card surfaces, spacing and faint fills from theme tokens, so light themes keep their tints and cards share one shape ([`ede2b06`](https://github.com/knowald/ha-hearth/commit/ede2b06))
- Store interface copy in sentence case, call dashboard pages "pages" throughout, and translate option labels, theme names and placeholders that were English only ([`7d403bf`](https://github.com/knowald/ha-hearth/commit/7d403bf))

### Added

- Drag a cover tile sideways to set its position, like a light tile sets brightness ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Control popup sliders from the keyboard ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Add move up and move down to the card, widget and stack editors ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Add hints and inline errors to editor fields ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Offer Overwrite and Reload when application settings were changed in another tab ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Open entity detail from weather, chart, status, energy and calendar widgets ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))

### Fixed

- Show the sign-in button on the boot screen only when a long-lived token is needed ([`5f99973`](https://github.com/knowald/ha-hearth/commit/5f99973))
- Keep a tap that closes search or wakes the screensaver from reaching the tile underneath ([`70c21a8`](https://github.com/knowald/ha-hearth/commit/70c21a8))
- Show command errors and the connection banner above open popups and sheets ([`5235598`](https://github.com/knowald/ha-hearth/commit/5235598))
- Accept taps on scenes, buttons and scripts that have not run yet and report `unknown` ([`5b3af77`](https://github.com/knowald/ha-hearth/commit/5b3af77))
- Confirm every garage door and gate move, from the tile, popup, slider and group actions, and send the direction that was confirmed ([`5b3af77`](https://github.com/knowald/ha-hearth/commit/5b3af77), [`6cda91b`](https://github.com/knowald/ha-hearth/commit/6cda91b))
- Open the media popup for media players from tiles and search ([`38d52ca`](https://github.com/knowald/ha-hearth/commit/38d52ca))
- Apply custom CSS without reloading the page, which dropped unsaved dashboard edits ([`e58f5d2`](https://github.com/knowald/ha-hearth/commit/e58f5d2))
- Keep Ctrl-S in an open editor sheet from opening the browser's save dialog ([`e58f5d2`](https://github.com/knowald/ha-hearth/commit/e58f5d2))
- Ask before dropping staged application settings ([`5581ef1`](https://github.com/knowald/ha-hearth/commit/5581ef1))
- Leave no empty stack behind when adding one is cancelled ([`b68bbb0`](https://github.com/knowald/ha-hearth/commit/b68bbb0))
- Apply the theme sheet's day/night switch fields as they change, like its other fields ([`e571b87`](https://github.com/knowald/ha-hearth/commit/e571b87))
- Keep read-only tiles from opening controls ([`b4b39dc`](https://github.com/knowald/ha-hearth/commit/b4b39dc))
- Let detail sliders reach every step of the entity ([`a5bafa2`](https://github.com/knowald/ha-hearth/commit/a5bafa2))
- Show climate and fan changes at once and pulse the control that was pressed until Home Assistant confirms ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Restore a `?theme=` preset once editing ends ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Copy edits as YAML, with Copied or Copy failed feedback instead of reporting a failed save ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Return from Versions to the configuration editor and from there to Settings ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Trap and restore keyboard focus in every popup, sheet and dialog ([`ede2b06`](https://github.com/knowald/ha-hearth/commit/ede2b06))

## [0.2.0] - 2026-09-22

### Changed

- Overhaul the import from Home Assistant: pages carry the area's own icon, floor grouping and registered temperature and humidity sensors, and split into Lighting, Covers, Devices, thermostat, media and camera cards instead of one Lighting and one Devices grid
- Place imported rail suggestions above the flexible spacer instead of below it, skip the ones the rail already covers, and propose a weather widget
- Write the template widget's Jinja in a code editor with highlighting; the plain box it replaces validated the template as YAML and reported a correct template as broken
- Rework the phone layout: the clock and weather ride above the page and the other widgets follow it, `mobile: top | bottom | hidden` on a widget overrides that, and a rail with a flexible gap in the middle is split there; `hide_mobile` still reads as `mobile: hidden`
- Fold every overlay to full width at the same place the rail folds; control popups and the edit bar changed shape at 700px and edit sheets at 820px
- Shed the page labels from all but the current page when a phone is held sideways, and keep the whole rail below the page there

### Added

- Export the dashboard to a YAML file and import one back from the configuration editor
- Add Versions to the Settings sheet: the snapshots every save keeps are listed, shown as a diff against the open dashboard, and can be downloaded or restored as an ordinary, undoable edit
- Apply the configuration editor with Ctrl-S
- Choose between adding the areas Hearth has no page for and replacing the existing pages when importing, with a confirmation before anything is removed

### Fixed

- Draw the keyboard focus ring around a framed text field (the search box, the padding steppers, the icon filter) instead of around the bare input inside it
- Keep text pushed into the configuration editor, such as an imported file, while the editor is still loading
- Skip config and diagnostic entities, and entities left behind by a removed integration, when importing an area
- Include camera-only areas when importing from Home Assistant
- Save the import when it runs outside edit mode; it was kept in memory only, so a reload dropped it
- Open a page at its own top rather than at the scroll offset left behind by the page before it
- Make the phone page switcher opaque, so the page no longer shows through the pills, and stop content landing underneath it
- Give the phone layout the side padding the wide one has
- Reach under device cutouts by adding `viewport-fit=cover`, without which every safe-area inset resolved to zero; landscape notches now inset the sides too
- Give the timer widget's buttons a thumb-sized hit area, and stop the dashboard scrolling sideways on a phone
- Keep a widget where it was dropped when it is dragged from one side of the phone layout to the other, and keep a widget hidden on mobile hidden when the widgets around it move
- Keep an unapplied YAML edit when Versions is opened from the configuration editor, and add a way back to it

## [0.1.3] - 2026-09-21

### Fixed

- Reuse the Home Assistant panel's login when Hearth is opened as an app (`/app/...`) instead of starting OAuth inside the iframe

## [0.1.2] - 2026-09-21

### Fixed

- Log in through Nabu Casa Ingress by using the forwarded Home Assistant origin and an explicit Ingress OAuth redirect URL

## [0.1.1] - 2026-09-21

### Added

- Add `HASS_PUBLIC_URL` for direct access when the server uses an internal Home Assistant address

### Fixed

- Log in through HTTPS Ingress and Nabu Casa by using the browser's Home Assistant origin
- Recover from expired or consumed login codes, and keep room, theme and kiosk settings after login
- Pin the CodeMirror dependency to the editor API the configuration editor and type checks use

## [0.1.0] - 2026-09-20

### Changed

- **Breaking:** require revisioned configuration saves and reject unsupported persisted document formats
- Establish Hearth as an independent dashboard with its own package, assets and Docker publishing target
- Float the theme editor over the dashboard as a draggable window, so edits preview live against the real layout
- Replace the browser's native colour input with an in-app picker: saturation square, hue strip, theme swatches and a hex field
- Replace camera playback and token login with Hearth components
- Separate configuration definitions from rendering components, so server and editor validation share the same schemas
- Establish semantic versioning from `0.1.0`

### Added

- Add frosted glass surfaces: a backdrop blur setting for every card, tile and widget, a scrim over the background image and an inherited text shadow
- Blur the edges where a scroll container cuts content off, on the page column, the editor sheet and the media shortcut row, with an off switch in Settings for slower screens
- Make the text ladder adjustable with contrast and shadow scales, plus muted-text and icon colours that no longer derive from the ink
- Add a Void (OLED) theme preset with a true-black background

### Removed

- Remove the retired dashboard, embedded objects, picture-elements tooling, alternate routes and cross-repository release automation

### Fixed

- Keep the standard `backdrop-filter` in the built stylesheet; writing the `-webkit-` prefix by hand made the minifier drop it, so no blur in the application took effect

[0.7.0]: https://github.com/knowald/ha-hearth/releases/tag/0.7.0
[0.6.0]: https://github.com/knowald/ha-hearth/releases/tag/0.6.0
[0.5.1]: https://github.com/knowald/ha-hearth/releases/tag/0.5.1
[0.5.0]: https://github.com/knowald/ha-hearth/releases/tag/0.5.0
[0.4.0]: https://github.com/knowald/ha-hearth/releases/tag/0.4.0
[0.3.0]: https://github.com/knowald/ha-hearth/releases/tag/0.3.0
[0.2.0]: https://github.com/knowald/ha-hearth/releases/tag/0.2.0
[0.1.3]: https://github.com/knowald/ha-hearth/releases/tag/0.1.3
[0.1.2]: https://github.com/knowald/ha-hearth/releases/tag/0.1.2
[0.1.1]: https://github.com/knowald/ha-hearth/releases/tag/0.1.1
[0.1.0]: https://github.com/knowald/ha-hearth/tree/0.1.0
