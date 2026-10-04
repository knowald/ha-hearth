import {
	ensureRoomCardColumns,
	isStack,
	takenCardIds,
	uniqueId,
	type HearthConfig,
	type HearthRoom,
	type OverviewCard,
	type RailWidget
} from './config';
import { cardDefinition } from './model/registry';
import type { ProposedPage } from './proposal';

/**
 * Replace rebuilds the dashboard from the areas, keeping only the first page;
 * add leaves every existing page alone and appends the new ones; merge also
 * appends new pages, and adds to an existing page only the area's entities
 * it does not show yet.
 */
export type ImportMode = 'replace' | 'add' | 'merge';

/** A page name already on the dashboard, matched the way the wizard shows it. */
export function pageNameKey(name: string) {
	return name.trim().toLowerCase();
}

export function existingPageNames(config: HearthConfig) {
	return new Set(config.rooms.map((room) => pageNameKey(room.name)));
}

function roomCards(room: HearthRoom): OverviewCard[] {
	return (room.cards ?? []).flat().flatMap((item) => (isStack(item) ? item.cards : [item]));
}

/** Every entity a page's cards show, header readings left out. */
export function roomEntityIds(room: HearthRoom): Set<string> {
	return new Set(
		roomCards(room).flatMap((card) => cardDefinition(card.type)?.entityIds(card as never) ?? [])
	);
}

/** The entities an area proposes that its existing page does not show yet. */
export function newEntityIds(room: HearthRoom, page: ProposedPage): string[] {
	const shown = roomEntityIds(room);
	return [...roomEntityIds(page.room)].filter((entity) => !shown.has(entity));
}

const domainOf = (entity: string) => entity.split('.')[0];

/**
 * Adds the area's entities a page does not show yet, leaving every card it
 * has in place. A new tile joins the first plain grid that already holds its
 * domain, else a copy of the proposed grid holding only the new tiles; a
 * single-entity card (thermostat, media, camera) is added whole. Returns how
 * many entities were added.
 */
export function mergeNewEntities(room: HearthRoom, page: ProposedPage, taken: string[]): number {
	const shown = roomEntityIds(room);
	const columns = ensureRoomCardColumns(room);
	let added = 0;
	const place = (card: OverviewCard, column: number) => {
		const id = uniqueId(card.id, taken);
		taken.push(id);
		columns[Math.min(column, columns.length - 1)].push({ ...card, id });
	};
	page.room.cards.forEach((column, columnIndex) => {
		for (const item of column) {
			if (isStack(item)) continue;
			if (item.type !== 'entities') {
				const entities = cardDefinition(item.type)?.entityIds(item as never) ?? [];
				if (!entities.length || entities.some((entity) => shown.has(entity))) continue;
				place(structuredClone(item), columnIndex);
				entities.forEach((entity) => shown.add(entity));
				added += entities.length;
				continue;
			}
			const fresh = item.entities.filter((ref) => !shown.has(ref.entity));
			const unplaced = fresh.filter((ref) => {
				const grid = roomCards(room).find(
					(card): card is Extract<OverviewCard, { type: 'entities' }> =>
						card.type === 'entities' &&
						!card.wildcard &&
						card.style !== 'stat' &&
						card.entities.some((other) => domainOf(other.entity) === domainOf(ref.entity))
				);
				grid?.entities.push(structuredClone(ref));
				return !grid;
			});
			if (unplaced.length) place({ ...structuredClone(item), entities: unplaced }, columnIndex);
			fresh.forEach((ref) => shown.add(ref.entity));
			added += fresh.length;
		}
	});
	return added;
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
	if (plan.mode === 'merge') {
		const taken = takenCardIds(config);
		const byName = new Map(config.rooms.map((room) => [pageNameKey(room.name), room]));
		for (const page of plan.pages) {
			const room = byName.get(pageNameKey(page.room.name));
			if (room) mergeNewEntities(room, page, taken);
		}
	}
	// the first page (Home) survives either way; replace drops the rest
	const existing = existingPageNames(config);
	const kept = plan.mode === 'replace' ? config.rooms.slice(0, 1) : config.rooms;
	const taken = kept.map((room) => room.id);
	const added =
		plan.mode !== 'replace'
			? plan.pages.filter((page) => !existing.has(pageNameKey(page.room.name)))
			: plan.pages;
	config.rooms = [...kept, ...added.map((page) => withUniqueIds(page, taken))];
}
