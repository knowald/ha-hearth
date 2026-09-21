import { uniqueId, type HearthConfig, type HearthRoom, type RailWidget } from './config';
import type { ProposedPage } from './proposal';

/**
 * Replace rebuilds the dashboard from the areas, keeping only the first page;
 * add leaves every existing page alone and appends the new ones.
 */
export type ImportMode = 'replace' | 'add';

/** A page name already on the dashboard, matched the way the wizard shows it. */
export function pageNameKey(name: string) {
	return name.trim().toLowerCase();
}

export function existingPageNames(config: HearthConfig) {
	return new Set(config.rooms.map((room) => pageNameKey(room.name)));
}

/** Gives a page and its cards ids no other page has taken. */
function withUniqueIds(page: ProposedPage, taken: string[]): HearthRoom {
	const id = uniqueId(page.room.id, taken);
	taken.push(id);
	if (id === page.room.id) return page.room;
	return {
		...page.room,
		id,
		cards: page.room.cards.map((column) =>
			column.map((item) => ({ ...item, id: `${id}${item.id.slice(page.room.id.length)}` }))
		)
	};
}

/**
 * Adds the rail suggestions the rail does not already cover, above the
 * trailing flexible spacer - anything below it is pinned to the bottom.
 */
export function mergeGlanceables(config: HearthConfig, glanceables: RailWidget[]) {
	const takenTypes = new Set(config.rail.map((widget) => widget.type));
	const takenLabels = new Set(
		config.rail.flatMap((widget) => (widget.type === 'label' ? [widget.text ?? ''] : []))
	);
	const fresh = glanceables.filter((widget) =>
		widget.type === 'label' ? !takenLabels.has(widget.text ?? '') : !takenTypes.has(widget.type)
	);
	// a label whose group was deduplicated away would head nothing
	const kept = fresh.filter(
		(widget, index) =>
			widget.type !== 'label' || (fresh[index + 1] && fresh[index + 1].type !== 'label')
	);
	if (!kept.length) return;
	const takenIds = config.rail.map((widget) => widget.id);
	const placed = kept.map((widget) => {
		const id = uniqueId(widget.id, takenIds);
		takenIds.push(id);
		return { ...widget, id };
	});
	const spacer = config.rail.findIndex(
		(widget) => widget.type === 'spacer' && !widget.height && !widget.line
	);
	config.rail.splice(spacer === -1 ? config.rail.length : spacer, 0, ...placed);
}

/** Writes the chosen pages and rail suggestions into a configuration draft. */
export function applyImport(
	config: HearthConfig,
	plan: { pages: ProposedPage[]; glanceables?: RailWidget[]; mode: ImportMode }
) {
	if (plan.glanceables?.length) mergeGlanceables(config, plan.glanceables);
	// the first page (Home) survives either way; replace drops the rest
	const existing = existingPageNames(config);
	const kept = plan.mode === 'replace' ? config.rooms.slice(0, 1) : config.rooms;
	const taken = kept.map((room) => room.id);
	const added =
		plan.mode === 'add'
			? plan.pages.filter((page) => !existing.has(pageNameKey(page.room.name)))
			: plan.pages;
	config.rooms = [...kept, ...added.map((page) => withUniqueIds(page, taken))];
}
