# Changelog

## 0.2.0

- Draw the keyboard focus ring around a framed text field (the search box, the padding steppers, the icon filter) instead of around the bare input inside it, where it traced a square box within a rounded one.
- Export the dashboard to a YAML file and import one back, from the configuration editor.
- Add Versions to the settings sheet. Every save already kept the file it replaced; those snapshots are now listed, shown as a diff against the dashboard you have open, and can be downloaded or restored. A restore lands as an ordinary edit, so it can be undone or cancelled before it is saved.
- Write the template widget's Jinja in a code editor with highlighting. The plain box it replaces validated the template as YAML, which reported a correct template as broken.
- Apply the configuration editor with Ctrl-S, and fix pushed-in text (an imported file) being ignored when the editor was still loading.
- Overhaul Import from Home Assistant: pages now carry the area's own icon, floor grouping and registered temperature and humidity sensors, and split into Lighting, Covers, Devices, thermostat, media and camera cards instead of one Lighting and one Devices grid.
- Skip config and diagnostic entities, and entities left behind by a removed integration, when importing an area.
- Choose between adding the areas Hearth has no page for and replacing the existing pages, with a confirmation before anything is removed.
- Save the import when it runs outside edit mode. It used to be kept in memory only, so a reload dropped it.
- Place rail suggestions above the flexible spacer instead of below it, skip the ones the rail already covers, and propose a weather widget.
- Rework the phone layout. The rail no longer follows the whole page: the clock and weather ride above it and the rest of the widgets follow, and `mobile: top | bottom | hidden` on a widget overrides that. A rail with a flexible gap in the middle is split there instead. `hide_mobile` still reads as `mobile: hidden`.
- Open a page at its own top rather than at the scroll offset left behind by the page before it.
- Fix the phone page switcher being half transparent, which let the page show through the pills as it scrolled past, and stop content landing underneath it when scrolled to.
- Give the phone layout the side padding the wide one has. Folding the rail dropped the 40px base entirely, so cards, widgets and readings sat against the glass.
- Reach under device cutouts: the viewport was missing `viewport-fit=cover`, so every safe-area inset in the stylesheets resolved to zero. Landscape notches now inset the sides too.
- Fold every overlay to full width at the same place the rail folds. Control popups and the edit bar changed shape at 700px and edit sheets at 820px, leaving a band where the layout was a phone's but the overlays were not.
- Shed the page labels from all but the current page when a phone is held sideways, and keep the whole rail below the page there.
- Give the timer widget's buttons a thumb-sized hit area, and stop the dashboard scrolling sideways on a phone.
- Keep a widget dragged from one side of the phone layout to the other: crossing the page is what sets where it sits, and a widget hidden on mobile stays hidden when the widgets around it are rearranged.
- Include camera-only areas when importing from Home Assistant. They were discarded before their camera cards were built.
- Keep an unapplied YAML edit when Versions is opened from the configuration editor, and add a way back to it. The draft was discarded with no way to recover it, not even through Undo.

## 0.1.3

- When Hearth is opened as a Home Assistant app (`/app/...`), reuse the panel's existing login instead of starting OAuth inside the iframe.

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
