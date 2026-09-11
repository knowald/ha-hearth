# Hearth application

This directory owns dashboard layout, navigation, editing and device presentation. Its data model is independent of Svelte rendering. See [architecture](../../../docs/architecture.md) for the enforced boundaries and current limitations.

## Adding a card or widget

1. Define the discriminated type in `types.ts` and shared field schemas in `schema.ts` where appropriate.
2. Add its pure definition under `model/cards/` or `model/widgets/`. Every definition supplies `normalize`, a Valibot `schema`, translation keys, an icon and `entityIds`. Cards also require `needsConfiguration`.
3. Register the definition in `model/registry.ts`. Compile-time coverage requires every supported type to be represented.
4. Add a renderer, descriptor and optional editor under `cards/<type>/` or `widgets/<type>/`. The descriptor combines the definition with its Svelte component and lazy editor loader. Register it in the corresponding rendering registry.
5. Include a configured example in the matrix fixture, cover behavior where needed and verify its editor in browser tests.

Definitions, schemas and normalization must not import renderers, stores, browser APIs or server code. Both the save endpoint and YAML editor call `hearthConfigIssues`; persistence must never accept data that the editor rejects.

## State and interaction

`store.ts` owns dashboard drafts, undo/redo, navigation and overlays. Home Assistant state comes from `core/ha`; device calls use `core/ha/commands` or a domain wrapper. Edit mode closes the command gate. Components must release subscriptions, timers and media resources on teardown.

Use `$lang()` for interface copy and `fill()` for placeholders. Styling uses `--h-*` tokens. Sheets use the shared focus/escape layer manager. Every control must support keyboard interaction; accessibility and style checks apply to the whole application.

`Card`, `Widget`, `Tile`, `Popup` and `Popover` identify distinct presentation roles. Editors sit next to their type's renderer; shared editor controls live in `edit/`. Prefer adding a domain module or explicit component over a generic embedded object or a second state system.
