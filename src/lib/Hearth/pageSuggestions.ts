import type { HassEntities } from 'home-assistant-js-websocket';
import type { RegistrySnapshot } from '$lib/core/ha/registry';
import {
	ensureRoomCardColumns,
	isStack,
	takenCardIds,
	uniqueId,
	type HearthConfig,
	type HearthRoom,
	type OverviewCard
} from './config';
import { pageNameKey } from './importPlan';
import { buildProposal } from './proposal';

/** A card the area behind a page would get from the import, offered one at a time. */
export interface CardSuggestion {
	card: OverviewCard;
	/** The column the import puts it in. */
	column: number;
}

/**
 * Pages do not record the area they came from, so a page is matched to the
 * area whose name or alias it carries, the way the import names its pages.
 */
export function suggestCards(
	room: Pick<HearthRoom, 'name'>,
	snapshot: RegistrySnapshot,
	currentStates: HassEntities
): CardSuggestion[] {
	const key = pageNameKey(room.name);
	const area = snapshot.areas.find((entry) =>
		[entry.name, ...(entry.aliases ?? [])].some((name) => pageNameKey(name) === key)
	);
	if (!area) return [];
	const page = buildProposal(snapshot, currentStates).pages.find(
		(entry) => entry.areaId === area.area_id
	);
	return (
		page?.room.cards.flatMap((column, index) =>
			column.flatMap((item) => (isStack(item) ? [] : [{ card: item, column: index }]))
		) ?? []
	);
}

/** Adds one suggested card to a page in a configuration draft. */
export function addSuggestedCard(config: HearthConfig, roomId: string, suggestion: CardSuggestion) {
	const room = config.rooms.find((entry) => entry.id === roomId);
	if (!room) return;
	const columns = ensureRoomCardColumns(room);
	const id = uniqueId(suggestion.card.id, takenCardIds(config));
	columns[Math.min(suggestion.column, columns.length - 1)].push({
		...structuredClone(suggestion.card),
		id
	});
}
