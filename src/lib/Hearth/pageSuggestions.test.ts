import { describe, expect, it } from 'vitest';
import type { RegistryEntity, RegistrySnapshot } from '$lib/core/ha/registry';
import { hassEntity } from '$lib/core/ha/testing';
import { DEFAULT_HEARTH_CONFIG, type HearthConfig } from './config';
import { addSuggestedCard, suggestCards } from './pageSuggestions';

function entity(entityId: string, area_id: string | null): RegistryEntity {
	return { entity_id: entityId, area_id, device_id: null, disabled_by: null, hidden_by: null };
}

const SNAPSHOT: RegistrySnapshot = {
	floors: [],
	areas: [
		{ area_id: 'living', name: 'Living room', aliases: ['Lounge'] },
		{ area_id: 'office', name: 'Office' }
	],
	devices: [],
	entities: [
		entity('light.sofa', 'living'),
		entity('media_player.tv', 'living'),
		entity('light.desk', 'office')
	]
};

const STATES = Object.fromEntries(
	SNAPSHOT.entities.map(({ entity_id }) => [entity_id, hassEntity(entity_id, 'on')])
);

describe('suggestCards', () => {
	it("offers the cards of the area the page is named after, and only that area's", () => {
		const suggestions = suggestCards({ name: ' living ROOM' }, SNAPSHOT, STATES);

		expect(suggestions.map(({ card, column }) => [card.type, column])).toEqual([
			['entities', 0],
			['media', 1]
		]);
		const entities = suggestions.flatMap(({ card }) =>
			card.type === 'entities' ? card.entities.map((ref) => ref.entity) : []
		);
		expect(entities).toEqual(['light.sofa']);
	});

	it('matches an area alias', () => {
		expect(suggestCards({ name: 'Lounge' }, SNAPSHOT, STATES)).toHaveLength(2);
	});

	it('offers nothing for a page named after no area', () => {
		expect(suggestCards({ name: 'Home' }, SNAPSHOT, STATES)).toEqual([]);
	});
});

describe('addSuggestedCard', () => {
	it('adds the card with a fresh id, in the last column the page has', () => {
		const config: HearthConfig = {
			...structuredClone(DEFAULT_HEARTH_CONFIG),
			rooms: [
				{ id: 'living-room', name: 'Living room', icon: 'weekend', cards: [] },
				{
					id: 'other',
					name: 'Other',
					icon: 'home',
					cards: [[{ id: 'living-room-media', type: 'template', content: 'x' }]]
				}
			]
		};
		const [, media] = suggestCards({ name: 'Living room' }, SNAPSHOT, STATES);

		addSuggestedCard(config, 'living-room', media);

		expect(config.rooms[0].cards).toEqual([
			[{ id: 'living-room-media-2', type: 'media', entity: 'media_player.tv' }]
		]);
	});
});
