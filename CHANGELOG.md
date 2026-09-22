# Changelog

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

[0.2.0]: https://github.com/knowald/ha-hearth/releases/tag/0.2.0
[0.1.3]: https://github.com/knowald/ha-hearth/releases/tag/0.1.3
[0.1.2]: https://github.com/knowald/ha-hearth/releases/tag/0.1.2
[0.1.1]: https://github.com/knowald/ha-hearth/releases/tag/0.1.1
[0.1.0]: https://github.com/knowald/ha-hearth/tree/0.1.0
