# Design

The rules a card, widget or popup follows so that it looks and behaves like the rest of Hearth. Read them before proposing a new card or a new look. Each rule states its reason, so it can be applied to cases this page does not list.

## Flat and themed

Draw with flat shapes: fills, strokes and plain icons. No illustrations, perspective, shading or fixed artwork.

Every color, size, radius, font and duration comes from a `--h-*` theme token. `pnpm check:style` fails on a literal value; mark a deliberate one with `/* literal ok: reason */`.

Why: a theme is a flat map of tokens, and one change to it restyles the whole dashboard, by day and by night. Artwork carries its own colors and depth, so it stays the same under every theme and has to be redrawn for each one.

A card has one visual language. Options such as `style: line` or `style: bar` choose between flat forms of the same data; they do not add a second look.

## Color has roles

A color says what something means, not which hue it has. The roles are:

| Role     | Use                                                 |
| -------- | --------------------------------------------------- |
| `accent` | The active state, the main reading, the middle tone |
| `cool`   | The second highlight, set apart from accent         |
| `good`   | A state that is fine                                |
| `bad`    | A state that needs attention                        |

There is no warning role. A three-step scale reads `good`, `accent`, `bad`.

A color a user sets in YAML goes through `styleColor` in `visibility.ts`, which accepts a role name or a CSS color and drops anything else.

Why: a theme assigns the hues. A card that asks for green or red by value ignores the theme and can lose its contrast on a light one. Passing user text through `styleColor` keeps it from writing past the one property it sets.

Colors that must be told apart also differ in lightness, since hue alone fails for many people.

## Scope

Built-in cards cover common needs in this one visual language. A visualization outside these rules is built by the person who wants it, with the [template card](configuration.md#template-card), the iframe card, or [custom CSS and JavaScript](configuration.md#custom-css-and-javascript).

Why: every built-in card is kept working across themes, screen sizes, locales and Home Assistant releases. The custom routes give full freedom without adding that cost for everyone.

## Interaction

- Tap opens the entity detail sheet, through `openEntityDetail`. A card with its own tap action still falls back to it.

  Why: one gesture with one meaning on every card, so nobody has to learn a card.

- Nothing reacts to a tap in edit mode. Check `$hearthEditMode`, as `StatTile.svelte` does.

  Why: in edit mode a tap selects the card for editing. A card that also acts on it switches a device by accident.

- A horizontal drag belongs to the page swipe. A control takes it only when dragging is its purpose, such as a slider, and marks itself with `data-no-swipe` or `touch-action: none`.

  Why: on a phone or a tablet the swipe is how pages change. A card that fills the page and takes the drag leaves no way to the next one.

- A touch target is at least `--h-touch-target`, 44px.

  Why: Hearth runs on wall tablets, used at arm's length and often in passing.

- Hover is an extra, never the only way to reach something. What hover shows, a tap shows too.

  Why: a touch screen has no hover.

## States every card draws

A card is designed for each of these, not only for the reading it shows on a good day.

| State                   | What to draw                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------- |
| Not configured          | The configuration placeholder, driven by `needsConfiguration` in the card's definition  |
| Missing or unavailable  | The card's frame with the state text, read with `entityAvailability`                    |
| Not a number            | `-` in place of the reading. `sensorNumber` returns null and `formatReading` prints `-` |
| No history              | `EmptyState` in place of the chart                                                      |
| Value outside the range | The drawing clamps to the range, the number shows the real reading                      |

Why: entities drop out, recorders start empty and sensors report text. A card that only handles the good case shows a broken layout or a wrong number exactly when someone looks at it to find out what is wrong.

## Type and numbers

- Readings use `--h-font-mono`. Names, labels and all other text use `--h-font-ui`.

  Why: digits of equal width keep a changing number from shifting its neighbors.

- Text color is one of `--h-text-1` to `--h-text-6`, from strongest to faintest, or `--h-label` for a field label. Pick the level that a comparable element on an existing card uses.

  Why: the levels set the order in which a card is read. A level picked for its look breaks that order on another theme.

- Sizes come from the `--h-type-*` tokens.

  Why: one scale keeps the same kind of text the same size on every card. `pnpm check:style` fails on a literal font size.

- Every reading is formatted by `formatReading` in `format.ts`: whole values bare, others to one decimal, `-` when there is none. Degrees and percent bind to the number, other units follow a space.

  Why: the same value reads the same on every card.

## Motion

- Durations come from the `--h-motion-*` tokens. An animation that cannot use a duration token turns itself off under `html[data-motion='off']`.

  Why: the reduce motion setting and the system preference set those tokens to 0ms and set that attribute. A literal duration keeps moving for someone who asked it to stop.

- Animate `transform` and `opacity` only.

  Why: other properties repaint on every frame, which a wall tablet cannot keep up with.

- Motion never carries meaning alone. A direction, a running state or a change is also visible when nothing moves.

  Why: with motion off, the meaning would be gone.

## Copy and translations

- Reuse an existing key before adding one.
- Keep text short, and never build a sentence from parts.

Why: a change only adds English, but each new key is translated into every locale at release, and a release fails while a locale is incomplete. See [translations](development.md#translations). Sentences built from parts cannot be translated, because word order differs between languages.

## Proposing a visual

1. Open an issue before drawing in detail, and say what the card shows and which entities it reads.
2. Draw the mockup with the default theme tokens.
3. Show it at phone and tablet width, in a day and a night theme. `pnpm matrix` renders those for a card that is already built.
4. Include the states above, at least unavailable and not configured.

Why: a mockup that follows the rules on this page can be accepted as drawn. One that does not has to be redone, and the time spent on it is lost.
