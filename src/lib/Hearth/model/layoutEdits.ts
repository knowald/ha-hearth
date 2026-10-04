import type { HearthConfig, HearthRoom, OverviewItem, RailWidget } from '../types';
import {
	cloneOverviewItem,
	ensureRoomCardColumns,
	findOverviewItemList,
	isStack,
	moveItem,
	slugify,
	takenCardIds,
	uniqueId
} from '../config';

/*
 * Layout changes the edit sheets make in one step: duplicating, moving a card
 * to another page, removing a stack with what it holds. Each mutates a config
 * draft inside updateConfig, so undo covers it. Only the editor uses these,
 * so they stay out of the dashboard's eager bundle.
 */

/** Moves the entry at `index` by `steps` places, stopping at either end of the list. */
export function shiftItem<T>(list: T[], index: number, steps: number) {
	const delta = Math.sign(steps);
	for (let step = 0; step < Math.abs(steps); step += 1) {
		moveItem(list, index, delta);
		index = Math.max(0, Math.min(list.length - 1, index + delta));
	}
}

/**
 * Copies a card or stack in place, right after the original. Every copied id
 * is new across the whole dashboard, a stack's children included. Returns the
 * copy's id.
 */
export function duplicateOverviewItem(
	config: HearthConfig,
	roomId: string,
	id: string
): string | undefined {
	const list = findOverviewItemList(config, id, roomId);
	const index = list?.findIndex((item) => item.id === id) ?? -1;
	if (!list || index < 0) return undefined;
	const copy = cloneOverviewItem(list[index], takenCardIds(config));
	list.splice(index + 1, 0, copy);
	return copy.id;
}

/** Copies the rail widget at `index` right after it, on the same side. Returns the copy's index. */
export function duplicateRailWidget(rail: RailWidget[], index: number): number | undefined {
	const source = rail[index];
	if (!source) return undefined;
	const copy = {
		...structuredClone(source),
		id: uniqueId(
			slugify(source.type),
			rail.map((widget) => widget.id)
		)
	};
	rail.splice(index + 1, 0, copy);
	return index + 1;
}

/**
 * Copies a page right after the original under `name`, with a page id and
 * card ids of its own so nothing on the copy collides with the original.
 * Returns the copy's id.
 */
export function duplicateRoom(
	config: HearthConfig,
	roomId: string,
	name: string
): string | undefined {
	const index = config.rooms.findIndex((room) => room.id === roomId);
	if (index < 0) return undefined;
	const source = config.rooms[index];
	const taken = takenCardIds(config);
	const copy: HearthRoom = {
		...structuredClone(source),
		id: uniqueId(
			slugify(name),
			config.rooms.map((room) => room.id)
		),
		name,
		cards: (source.cards ?? []).map((column) =>
			column.map((item) => cloneOverviewItem(item, taken))
		)
	};
	config.rooms.splice(index + 1, 0, copy);
	return copy.id;
}

/** How many card columns a page has, including ones not written yet. */
export function roomColumnCount(room: Pick<HearthRoom, 'cards' | 'columns'>): number {
	return room.cards?.length || room.columns || 1;
}

/** The column holding a card, whether at the top level or inside a stack. */
export function cardColumnIndex(room: HearthRoom, id: string): number {
	return (room.cards ?? []).findIndex((column) =>
		column.some(
			(item) => item.id === id || (isStack(item) && item.cards.some((card) => card.id === id))
		)
	);
}

/**
 * Moves a card or stack to the end of a column on another page, or another
 * column of its own. A card leaves any stack it was in. A column past the
 * page's last lands in its last one.
 */
export function moveOverviewItem(
	config: HearthConfig,
	id: string,
	fromRoomId: string,
	toRoomId: string,
	column: number
): boolean {
	const target = config.rooms.find((room) => room.id === toRoomId);
	const source = findOverviewItemList(config, id, fromRoomId);
	const index = source?.findIndex((item) => item.id === id) ?? -1;
	if (!target || !source || index < 0) return false;
	const [item] = source.splice(index, 1) as OverviewItem[];
	const columns = ensureRoomCardColumns(target);
	columns[Math.max(0, Math.min(columns.length - 1, column))].push(item);
	return true;
}

/** Removes a stack together with every card in it. */
export function removeStackWithCards(
	config: HearthConfig,
	roomId: string,
	stackId: string
): boolean {
	const list = findOverviewItemList(config, stackId, roomId);
	const index = list?.findIndex((item) => item.id === stackId) ?? -1;
	if (!list || index < 0 || !isStack(list[index])) return false;
	list.splice(index, 1);
	return true;
}
