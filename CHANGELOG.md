# Changelog

## [0.7.0] - 2026-10-05

### Changed

- Reorganize Settings into clearer sections that say which screens they affect, and rename Application settings to Server settings ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Hide rarely used options in the card and widget editors behind an Advanced toggle ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Load the editing tools only when you start editing, so the dashboard starts faster ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Apply theme colors safely: an invalid value falls back to the default instead of breaking the page, and the editors reject it ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Accept short hex colors such as `#f80` in themes ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Match screen-size conditions inside `or` groups, which were ignored before ([#31](https://github.com/knowald/ha-hearth/pull/31))

### Added

- Show Hearth in every language Home Assistant supports ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Ask before discarding unsaved changes when you close an editor or reload the page ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Warn before editing when another screen has saved newer changes ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Add a This screen menu for settings that apply to one device only, such as language, scale, sleep screen and keeping the screen awake ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Protect the edit button from accidental taps with a long press or a PIN (`edit_lock`) ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Open a card or widget's editor by tapping it in edit mode ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Duplicate cards, widgets and pages, and move cards to another page ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Undo removing a card or widget, and show a dot on Save when there are unsaved changes ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Add and reorder pages from the phone page strip and from Settings > Pages ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Point out missing required fields and unknown entities in the editors ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Find entities faster: search by area or device, filter by area and pick several at once ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Set tap and hold actions on tiles, using the same options as Home Assistant dashboards ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Run scenes and scripts straight from search ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Let automations switch pages, wake the screen or put it to sleep ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Show or hide pages with conditions, including time of day, weekday, device and entity attributes ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Change a tile's color, icon or style based on conditions ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Show Home Assistant templates in a template card and in tile names and states ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Add a to-do list card ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Show a photo slideshow, a sky that follows the sun or the playing album art on the sleep screen ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Edit, copy and paste single cards and widgets as YAML ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Share themes by exporting and importing them ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Animate tile icons, such as a spinning fan or a glowing light ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Play an optional sound when an alert appears ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Greet people when they come home ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Show a badge when today's energy use is below the weekly average ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Finish setup with the tablet's address and a QR code ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Start from a ready-made layout for a kitchen tablet, phone or bedside screen ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Add only new entities when importing an area again ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Suggest cards for an empty page named after an area ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Keep a favorites page on your phone ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Add Winter, Spring meadow, Autumn and Holiday theme presets ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Change the theme by date or condition with a theme schedule ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Give each page its own theme and background image ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Let cards span several columns ([#31](https://github.com/knowald/ha-hearth/pull/31))

### Fixed

- Stop a tap that closes a sheet from also tapping what is underneath ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Keep the sleep screen and Home Assistant refresh events from interrupting editing ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Make the Reload and Log out buttons reload the page every time ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Clear old save errors when you start editing ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Make editor controls easier to tap and read, and stop iOS from zooming into text fields ([#31](https://github.com/knowald/ha-hearth/pull/31))
- Respond to reduced motion changes right away, and make touch dragging reliable on iPad ([#31](https://github.com/knowald/ha-hearth/pull/31))

## [0.6.0] - 2026-10-03

### Added

- Scale the whole interface from 50 to 200 percent, with a separate scale for phones ([#27](https://github.com/knowald/ha-hearth/pull/27))
- Set separate side and top/bottom padding for phones ([#27](https://github.com/knowald/ha-hearth/pull/27))
- Show a small clock with the date at the start of the phone page strip ([#28](https://github.com/knowald/ha-hearth/pull/28))
- Highlight an entity tile from another entity or a list of states, while it keeps showing its own state ([#20](https://github.com/knowald/ha-hearth/pull/20), [#29](https://github.com/knowald/ha-hearth/pull/29))

## [0.5.1] - 2026-09-29

### Fixed

- Give the media popup's playback controls the full width on phones ([#19](https://github.com/knowald/ha-hearth/pull/19))
- Show at most two columns per card on phones, and one tile per row while editing ([#19](https://github.com/knowald/ha-hearth/pull/19))
- Stop a vertical drag or a second finger on a light or blind tile from toggling it ([#19](https://github.com/knowald/ha-hearth/pull/19))
- Set a popup slider where you tap it, and ignore right and middle clicks on sliders ([#19](https://github.com/knowald/ha-hearth/pull/19))
- Allow pinch zoom to start on light and blind tiles ([#19](https://github.com/knowald/ha-hearth/pull/19))
- Keep sheets, toasts, the edit button and the wide layout clear of the notch and the home indicator ([#19](https://github.com/knowald/ha-hearth/pull/19))
- Stop iOS from zooming in when you tap a text field ([#19](https://github.com/knowald/ha-hearth/pull/19))
- Shorten long edit sheet titles so the close button stays on screen ([#19](https://github.com/knowald/ha-hearth/pull/19))
- Keep toasts and the last widget clear of the edit bar when it wraps onto two rows ([#19](https://github.com/knowald/ha-hearth/pull/19))
- Make drag handles, progress bars and volume bars easier to touch ([#19](https://github.com/knowald/ha-hearth/pull/19))
- Shrink search and edit sheets when the keyboard opens on Android ([#19](https://github.com/knowald/ha-hearth/pull/19))

## [0.5.0] - 2026-09-28

### Changed

- Show notifications as one button with a count and the newest title ([`2f6f489`](https://github.com/knowald/ha-hearth/commit/2f6f489))
- Move the screensaver settings into their own Sleep screen section, with a preview button ([`2a5d6dd`](https://github.com/knowald/ha-hearth/commit/2a5d6dd))
- Remove the https note under touch feedback in App settings ([`bbf9636`](https://github.com/knowald/ha-hearth/commit/bbf9636))

### Added

- Put the sidebar on the left, the right, both sides or hide it ([`80deda2`](https://github.com/knowald/ha-hearth/commit/80deda2))
- Swipe sideways between pages, on phones and with a mouse ([`9c54527`](https://github.com/knowald/ha-hearth/commit/9c54527))
- Raise alerts from dashboard rules, such as a fridge door left open, and close them when the problem clears ([`2f6f489`](https://github.com/knowald/ha-hearth/commit/2f6f489))
- Let Home Assistant automations raise and dismiss alerts and open or close popups ([`2f6f489`](https://github.com/knowald/ha-hearth/commit/2f6f489))
- Name each screen so an automation can send an alert to just that one ([`2f6f489`](https://github.com/knowald/ha-hearth/commit/2f6f489))
- Wake the sleep screen while an alert is showing ([`2f6f489`](https://github.com/knowald/ha-hearth/commit/2f6f489))
- Show an image or a live weather radar map behind the sleep screen clock ([`2a5d6dd`](https://github.com/knowald/ha-hearth/commit/2a5d6dd))
- Set the sleep screen clock size and show the date and the weather ([`2a5d6dd`](https://github.com/knowald/ha-hearth/commit/2a5d6dd))

### Fixed

- Stop the grey tap highlight, long-press menu and stuck hover state on touch screens ([`4ed7ae9`](https://github.com/knowald/ha-hearth/commit/4ed7ae9))

## [0.4.0] - 2026-09-26

### Added

- Show a web page, such as Music Assistant, as a card on any page ([`e2b1748`](https://github.com/knowald/ha-hearth/commit/e2b1748))
- Use a background image on header cards and the theme, from a URL or an upload ([`6324403`](https://github.com/knowald/ha-hearth/commit/6324403))

### Fixed

- Play cameras that only support WebRTC, such as Ring live view ([`19b4bd7`](https://github.com/knowald/ha-hearth/commit/19b4bd7), [`756c09d`](https://github.com/knowald/ha-hearth/commit/756c09d))
- Keep showing the snapshot of a camera that has no live stream ([`75799d8`](https://github.com/knowald/ha-hearth/commit/75799d8))
- Load Hearth behind an nginx reverse proxy that answered with a 502 error ([`c9eee00`](https://github.com/knowald/ha-hearth/commit/c9eee00))

## [0.3.0] - 2026-09-23

### Changed

- Show why the connection fails on the boot screen, with a hint and a Retry button ([`23f870f`](https://github.com/knowald/ha-hearth/commit/23f870f))
- Keep the sign-in sheet open until Home Assistant accepts the token, and say when it does not ([`23f870f`](https://github.com/knowald/ha-hearth/commit/23f870f))
- Explain an unreadable or invalid `hearth.yaml` or `configuration.yaml` in the error banner, with a Reload button ([`f205c5b`](https://github.com/knowald/ha-hearth/commit/f205c5b))
- Tell a slow Home Assistant connection apart from a lost one ([`f205c5b`](https://github.com/knowald/ha-hearth/commit/f205c5b))
- Keep the first-run area import open on a stray tap and offer Skip for now ([`f205c5b`](https://github.com/knowald/ha-hearth/commit/f205c5b))
- Move the area import to Settings, and offer it on an empty home page ([`f205c5b`](https://github.com/knowald/ha-hearth/commit/f205c5b), [`153a411`](https://github.com/knowald/ha-hearth/commit/153a411))
- Open the same detail sheet for an entity from every tile, search result and widget ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Send a vacuum home from every screen, and offer the same actions in its detail sheet ([`15a5e62`](https://github.com/knowald/ha-hearth/commit/15a5e62), [`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Ask before unlocking or opening a lock, but not before locking it ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Label each editor sheet's header button by what it does: Close, Done, Apply or Save ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Ask the same way before every destructive editor action, and stop asking before a stack is unwrapped ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Share one visibility section and one live preview between the card and widget editors ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Show whole readings without a decimal and use the Home Assistant temperature unit everywhere ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Always keep a way to change pages in a wide sidebar with no navigation widget ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4), [`bea0e74`](https://github.com/knowald/ha-hearth/commit/bea0e74))
- Close the top popup, sheet or search with the browser or Android back button, and keep the current page in `?room=` ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Show search as a full-width sheet on phones ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Let only the edit chip react on sidebar widgets while editing ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Hide sidebar widgets with nothing to show, and show "-" for an unavailable entity ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Stop all motion when reduced motion is set in Hearth or the operating system ([`ede2b06`](https://github.com/knowald/ha-hearth/commit/ede2b06))
- Take shadows, card surfaces and spacing from the theme, so light themes keep their tints ([`ede2b06`](https://github.com/knowald/ha-hearth/commit/ede2b06))
- Use sentence case for interface text, call dashboard pages "pages", and translate labels that were English only ([`7d403bf`](https://github.com/knowald/ha-hearth/commit/7d403bf))

### Added

- Drag a cover tile sideways to set its position ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Control popup sliders from the keyboard ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Add move up and move down to the card, widget and stack editors ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Add hints and inline errors to editor fields ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Offer Overwrite and Reload when application settings were changed in another tab ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Open entity details from weather, chart, status, energy and calendar widgets ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))

### Fixed

- Show the sign-in button on the boot screen only when a long-lived token is needed ([`5f99973`](https://github.com/knowald/ha-hearth/commit/5f99973))
- Stop a tap that closes search or wakes the screensaver from also tapping the tile underneath ([`70c21a8`](https://github.com/knowald/ha-hearth/commit/70c21a8))
- Show command errors and the connection banner above open popups and sheets ([`5235598`](https://github.com/knowald/ha-hearth/commit/5235598))
- Accept taps on scenes, buttons and scripts that have not run yet ([`5b3af77`](https://github.com/knowald/ha-hearth/commit/5b3af77))
- Ask before every garage door and gate move, and send the direction that was confirmed ([`5b3af77`](https://github.com/knowald/ha-hearth/commit/5b3af77), [`6cda91b`](https://github.com/knowald/ha-hearth/commit/6cda91b))
- Open the media popup for media players from tiles and search ([`38d52ca`](https://github.com/knowald/ha-hearth/commit/38d52ca))
- Apply custom CSS without reloading the page and losing unsaved edits ([`e58f5d2`](https://github.com/knowald/ha-hearth/commit/e58f5d2))
- Stop Ctrl-S in an open editor from opening the browser's save dialog ([`e58f5d2`](https://github.com/knowald/ha-hearth/commit/e58f5d2))
- Ask before dropping staged application settings ([`5581ef1`](https://github.com/knowald/ha-hearth/commit/5581ef1))
- Stop leaving an empty stack behind when adding one is cancelled ([`b68bbb0`](https://github.com/knowald/ha-hearth/commit/b68bbb0))
- Apply the theme sheet's day/night fields as you change them ([`e571b87`](https://github.com/knowald/ha-hearth/commit/e571b87))
- Stop read-only tiles from opening controls ([`b4b39dc`](https://github.com/knowald/ha-hearth/commit/b4b39dc))
- Let detail sliders reach every step of the entity ([`a5bafa2`](https://github.com/knowald/ha-hearth/commit/a5bafa2))
- Show climate and fan changes at once, and pulse the pressed control until Home Assistant confirms ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Restore a `?theme=` preset when editing ends ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Show Copied or Copy failed when copying edits as YAML, instead of a failed save ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Return from Versions to the configuration editor, and from there to Settings ([`06d51f4`](https://github.com/knowald/ha-hearth/commit/06d51f4))
- Keep keyboard focus inside every popup, sheet and dialog, and restore it when closed ([`ede2b06`](https://github.com/knowald/ha-hearth/commit/ede2b06))

## [0.2.0] - 2026-09-22

### Changed

- Rebuild the import from Home Assistant so each page gets its area's icon, sensors and separate cards for lights, covers, devices, thermostats, media and cameras
- Place suggested sidebar widgets above the spacer, skip ones already there, and suggest a weather widget
- Edit the template widget in a code editor, which no longer reports a correct template as broken
- Rework the phone layout so the clock and weather sit above the page, and let `mobile: top | bottom | hidden` on a widget override that
- Switch popups and the edit bar to full width at the same screen size as the sidebar
- Show only the current page's label when a phone is held sideways

### Added

- Export the dashboard to a YAML file and import one back from the configuration editor
- Add Versions to Settings, to compare, download or restore the snapshots kept on every save
- Apply the configuration editor with Ctrl-S
- Choose whether importing adds the missing areas or replaces the existing pages, with a confirmation first

### Fixed

- Draw the keyboard focus ring around the whole search box and other framed fields
- Keep text pushed into the configuration editor, such as an imported file, while it loads
- Skip config and diagnostic entities, and entities left by a removed integration, when importing an area
- Include areas that only have cameras when importing from Home Assistant
- Save the import when it runs outside edit mode, so a reload no longer drops it
- Open each page at its own top instead of where the previous page was scrolled
- Make the phone page switcher opaque, and stop content landing underneath it
- Give the phone layout the same side padding as the wide one
- Keep content clear of phone cutouts, including the sides in landscape
- Make the timer widget's buttons easier to tap, and stop the dashboard scrolling sideways on a phone
- Keep a widget where you drop it on the phone layout, and keep widgets hidden on mobile hidden
- Keep an unapplied YAML edit when you open Versions, and add a way back to it

## [0.1.3] - 2026-09-21

### Fixed

- Reuse the Home Assistant panel's login when Hearth opens as an app, instead of starting OAuth inside the iframe

## [0.1.2] - 2026-09-21

### Fixed

- Log in through Nabu Casa Ingress

## [0.1.1] - 2026-09-21

### Added

- Add `HASS_PUBLIC_URL` for direct access when the server uses an internal Home Assistant address

### Fixed

- Log in through HTTPS Ingress and Nabu Casa
- Recover from expired login codes, and keep room, theme and kiosk settings after login
- Pin the CodeMirror dependency to the version the configuration editor uses

## [0.1.0] - 2026-09-20

### Changed

- **Breaking:** require revisioned configuration saves and reject unsupported saved formats
- Make Hearth an independent dashboard with its own package, assets and Docker image
- Float the theme editor over the dashboard as a draggable window, so edits preview live
- Replace the browser's color input with a picker that has a saturation square, hue strip, theme swatches and a hex field
- Replace camera playback and token login with Hearth's own versions
- Share the same configuration rules between the server and the editor
- Use semantic versioning from `0.1.0`

### Added

- Add frosted glass surfaces, with a blur setting for every card, tile and widget
- Blur the edges where scrolling content is cut off, with an off switch in Settings for slower screens
- Adjust text contrast and shadow, and set muted text and icon colors separately
- Add a Void (OLED) theme preset with a true black background

### Removed

- Remove the retired dashboard, embedded objects, picture-elements tooling, alternate routes and cross-repository release automation

### Fixed

- Make blur work everywhere in the application

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
