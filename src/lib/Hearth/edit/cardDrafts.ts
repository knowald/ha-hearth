import type { HearthRoom, OverviewCard } from '../types';
import { roomEntityIds } from '../importPlan';
import { cardDefinition } from '../model/registry';

export interface DraftSources {
	room: Pick<HearthRoom, 'name' | 'cards'>;
	/** What the import would give the page's area (see suggestCards), if anything. */
	suggestions: OverviewCard[];
	/** Every entity id Home Assistant reports. */
	knownIds: string[];
}

/**
 * The card the add-card gallery previews for a type, and the editor starts
 * from once it is picked: the import's own card for the page's area when it
 * brings something the page does not show yet, else the type's draft from
 * the page's entities and then everything else, else the bare type.
 */
export function draftCard(type: OverviewCard['type'], sources: DraftSources): OverviewCard {
	const definition = cardDefinition(type);
	if (!definition) return { id: '', type } as OverviewCard;
	const shown = roomEntityIds(sources.room as HearthRoom, sources.knownIds);
	const suggestion = sources.suggestions.find(
		(card) =>
			card.type === type && definition.entityIds(card as never).some((entity) => !shown.has(entity))
	);
	let raw: Record<string, unknown>;
	if (suggestion) {
		raw = structuredClone(suggestion) as Record<string, unknown>;
		delete raw.id;
	} else {
		const known = new Set(sources.knownIds);
		const entityIds = [
			...new Set([
				...[...shown].filter((entity) => known.has(entity)),
				...[...sources.knownIds].sort()
			])
		];
		raw = definition.draft?.({ entityIds, pageName: sources.room.name }) ?? {};
	}
	return { ...raw, ...definition.normalize(raw), id: '', type } as OverviewCard;
}
