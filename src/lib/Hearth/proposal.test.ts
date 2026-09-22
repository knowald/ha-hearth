import { describe, expect, it } from 'vitest';
import type { HassEntities } from 'home-assistant-js-websocket';
import type { RegistryEntity, RegistrySnapshot } from '$lib/core/ha/registry';
import { buildProposal, type ProposedPage } from './proposal';
import { isStack, type OverviewCard } from './config';
import { hassEntity } from './testing';

const EMPTY: RegistrySnapshot = { floors: [], areas: [], devices: [], entities: [] };

function entity(entityId: string, extra: Partial<RegistryEntity> = {}): RegistryEntity {
	return {
		entity_id: entityId,
		area_id: null,
		device_id: null,
		disabled_by: null,
		hidden_by: null,
		...extra
	};
}

/** Entity states keyed by id, from `entityId: [state, attributes]` pairs. */
function hassStates(entries: Record<string, [string, Record<string, unknown>?]>): HassEntities {
	return Object.fromEntries(
		Object.entries(entries).map(([entityId, [state, attributes]]) => [
			entityId,
			hassEntity(entityId, state, attributes)
		])
	);
}

/** A state object for every registry entry, plus any extras the test needs. */
function statesFor(entities: RegistryEntity[], extra: HassEntities = {}): HassEntities {
	return {
		...hassStates(Object.fromEntries(entities.map((item) => [item.entity_id, ['on'] as [string]]))),
		...extra
	};
}

function cards(page: ProposedPage): OverviewCard[] {
	return page.room.cards.flat().filter((item): item is OverviewCard => !isStack(item));
}

function cardOfType(page: ProposedPage, type: string) {
	return cards(page).find((card) => card.type === type);
}

describe('buildProposal pages', () => {
	const entities = [
		entity('light.kitchen_ceiling', { area_id: 'kitchen' }),
		entity('light.kitchen_counter', { area_id: 'kitchen' }),
		entity('cover.kitchen_blind', { area_id: 'kitchen' }),
		entity('switch.kettle', { area_id: 'kitchen' }),
		entity('climate.kitchen', { area_id: 'kitchen' }),
		entity('media_player.kitchen_speaker', { area_id: 'kitchen' }),
		entity('camera.kitchen', { area_id: 'kitchen' })
	];
	const snapshot: RegistrySnapshot = {
		...EMPTY,
		areas: [{ area_id: 'kitchen', name: 'Kitchen' }],
		entities
	};

	it('splits an area into per-domain cards', () => {
		const [page] = buildProposal(snapshot, statesFor(entities)).pages;

		expect(cards(page).map((card) => card.id)).toEqual([
			'kitchen-lighting',
			'kitchen-covers',
			'kitchen-devices',
			'kitchen-climate',
			'kitchen-media',
			'kitchen-camera'
		]);
		expect(page.counts).toEqual({
			lights: 2,
			covers: 1,
			climate: 1,
			media: 1,
			cameras: 1,
			devices: 1
		});
	});

	it('puts the grids and the single-entity cards in their own columns', () => {
		const [page] = buildProposal(snapshot, statesFor(entities)).pages;

		expect(page.room.cards).toHaveLength(2);
		expect(page.room.cards[1].map((card) => card.id)).toEqual([
			'kitchen-climate',
			'kitchen-media',
			'kitchen-camera'
		]);
	});

	it('keeps a page with only grids in a single column', () => {
		const lightsOnly = [entity('light.kitchen_ceiling', { area_id: 'kitchen' })];
		const [page] = buildProposal(
			{ ...snapshot, entities: lightsOnly },
			statesFor(lightsOnly)
		).pages;

		expect(page.room.cards).toHaveLength(1);
	});

	it('drops the area name from entity names and sorts by the result', () => {
		const named = statesFor(
			entities,
			hassStates({
				'light.kitchen_ceiling': ['on', { friendly_name: 'Kitchen Ceiling' }],
				'light.kitchen_counter': ['on', { friendly_name: 'Counter Kitchen' }]
			})
		);

		const card = cardOfType(buildProposal(snapshot, named).pages[0], 'entities') as Extract<
			OverviewCard,
			{ type: 'entities' }
		>;

		expect(card.entities.map((ref) => ref.name)).toEqual(['Ceiling', 'Counter']);
	});

	it('keeps a name the area only prefixes as part of a longer word', () => {
		const named = statesFor(
			entities,
			hassStates({
				'light.kitchen_ceiling': ['on', { friendly_name: 'Kitchenette Lamp' }],
				'light.kitchen_counter': ['on', { friendly_name: 'Counter' }]
			})
		);

		const card = cardOfType(buildProposal(snapshot, named).pages[0], 'entities') as Extract<
			OverviewCard,
			{ type: 'entities' }
		>;

		expect(card.entities.map((ref) => ref.name)).toContain('Kitchenette Lamp');
	});

	it('skips config, diagnostic, disabled, hidden and orphaned entities', () => {
		const mixed = [
			entity('light.kept', { area_id: 'kitchen' }),
			entity('switch.child_lock', { area_id: 'kitchen', entity_category: 'config' }),
			entity('sensor.signal', { area_id: 'kitchen', entity_category: 'diagnostic' }),
			entity('light.disabled', { area_id: 'kitchen', disabled_by: 'user' }),
			entity('light.hidden', { area_id: 'kitchen', hidden_by: 'user' }),
			entity('light.orphan', { area_id: 'kitchen' }),
			entity('light.stateless', { area_id: 'kitchen' })
		];
		const currentStates = statesFor(
			mixed.filter((item) => item.entity_id !== 'light.stateless'),
			hassStates({ 'light.orphan': ['unavailable', { restored: true }] })
		);

		const card = cardOfType(
			buildProposal({ ...snapshot, entities: mixed }, currentStates).pages[0],
			'entities'
		) as Extract<OverviewCard, { type: 'entities' }>;

		expect(card.entities.map((ref) => ref.entity)).toEqual(['light.kept']);
	});

	it('falls back to the device area and skips entities without one', () => {
		const placed = [
			entity('light.lamp', { device_id: 'device-1' }),
			entity('light.nowhere', { device_id: 'device-2' }),
			entity('light.loose')
		];

		const proposal = buildProposal(
			{
				...EMPTY,
				areas: [{ area_id: 'office', name: 'Office' }],
				devices: [
					{ id: 'device-1', area_id: 'office' },
					{ id: 'device-2', area_id: null }
				],
				entities: placed
			},
			statesFor(placed)
		);

		const card = cardOfType(proposal.pages[0], 'entities') as Extract<
			OverviewCard,
			{ type: 'entities' }
		>;
		expect(card.entities.map((ref) => ref.entity)).toEqual(['light.lamp']);
	});

	it('proposes a page for an area that only has cameras', () => {
		const only = [entity('camera.porch', { area_id: 'porch' })];
		const pages = buildProposal(
			{ ...EMPTY, areas: [{ area_id: 'porch', name: 'Porch' }], entities: only },
			statesFor(only)
		).pages;
		expect(pages).toHaveLength(1);
		expect(cardOfType(pages[0], 'camera')).toBeDefined();
	});
});

describe('buildProposal page metadata', () => {
	const lights = [
		entity('light.a', { area_id: 'a' }),
		entity('light.b', { area_id: 'b' }),
		entity('light.c', { area_id: 'c' })
	];

	it('orders areas by floor level, then by name', () => {
		const proposal = buildProposal(
			{
				...EMPTY,
				floors: [
					{ floor_id: 'upstairs', name: 'Upstairs', level: 1 },
					{ floor_id: 'ground', name: 'Ground', level: 0 }
				],
				areas: [
					{ area_id: 'a', name: 'Attic', floor_id: 'upstairs' },
					{ area_id: 'b', name: 'Basement' },
					{ area_id: 'c', name: 'Cellar', floor_id: 'ground' }
				],
				entities: lights
			},
			statesFor(lights)
		);

		expect(proposal.pages.map((page) => page.room.name)).toEqual(['Cellar', 'Attic', 'Basement']);
		expect(proposal.pages.map((page) => page.floorName)).toEqual(['Ground', 'Upstairs', undefined]);
	});

	it('prefers the area icon over a guess from the area name', () => {
		const single = [entity('light.a', { area_id: 'a' })];
		const iconOf = (area: { area_id: string; name: string; icon?: string }) =>
			buildProposal({ ...EMPTY, areas: [area], entities: single }, statesFor(single)).pages[0].room
				.icon;

		expect(iconOf({ area_id: 'a', name: 'Sypialnia', icon: 'mdi:bed' })).toBe('bed');
		expect(iconOf({ area_id: 'a', name: 'Living Room' })).toBe('weekend');
		expect(iconOf({ area_id: 'a', name: 'Sypialnia' })).toBe('meeting_room');
	});

	it('takes the area temperature and humidity entities when it has them', () => {
		const area = [
			entity('light.a', { area_id: 'a' }),
			entity('sensor.room_temp', { area_id: 'a' }),
			entity('sensor.room_humidity', { area_id: 'a' })
		];
		const currentStates = statesFor(
			area,
			hassStates({
				'sensor.room_temp': ['21', { device_class: 'temperature' }],
				'sensor.room_humidity': ['45', { device_class: 'humidity' }]
			})
		);

		const guessed = buildProposal(
			{ ...EMPTY, areas: [{ area_id: 'a', name: 'Office' }], entities: area },
			currentStates
		).pages[0].room;
		expect([guessed.temp_entity, guessed.humidity_entity]).toEqual([
			'sensor.room_temp',
			'sensor.room_humidity'
		]);

		const registered = buildProposal(
			{
				...EMPTY,
				areas: [
					{
						area_id: 'a',
						name: 'Office',
						temperature_entity_id: 'sensor.chosen_temp',
						humidity_entity_id: 'sensor.chosen_humidity'
					}
				],
				entities: area
			},
			currentStates
		).pages[0].room;
		expect([registered.temp_entity, registered.humidity_entity]).toEqual([
			'sensor.chosen_temp',
			'sensor.chosen_humidity'
		]);
	});

	it('gives areas that slug alike their own page and card ids', () => {
		const pair = [entity('light.a', { area_id: 'a' }), entity('light.b', { area_id: 'b' })];

		const proposal = buildProposal(
			{
				...EMPTY,
				areas: [
					{ area_id: 'a', name: 'Guest room' },
					{ area_id: 'b', name: 'Guest Room' }
				],
				entities: pair
			},
			statesFor(pair)
		);

		expect(proposal.pages.map((page) => page.room.id)).toEqual(['guest-room', 'guest-room-2']);
		expect(cards(proposal.pages[1])[0].id).toBe('guest-room-2-lighting');
	});
});

describe('buildProposal glanceables', () => {
	it('suggests a skippable Today group only when matching entities exist', () => {
		const proposal = buildProposal(
			EMPTY,
			hassStates({
				'weather.home': ['sunny'],
				'sensor.house_energy': ['12', { device_class: 'energy', unit_of_measurement: 'kWh' }],
				'sensor.dishwasher_status': ['running', { friendly_name: 'Dishwasher' }],
				'calendar.family': ['on']
			})
		);

		expect(proposal.glanceables.map((widget) => widget.type)).toEqual([
			'weather',
			'label',
			'energy',
			'progress',
			'calendar'
		]);
		expect(buildProposal(EMPTY, {}).glanceables).toEqual([]);
	});

	it('leaves out the Today label when only a weather entity matched', () => {
		const proposal = buildProposal(EMPTY, hassStates({ 'weather.home': ['sunny'] }));

		expect(proposal.glanceables.map((widget) => widget.type)).toEqual(['weather']);
	});
});
