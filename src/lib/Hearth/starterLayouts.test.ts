import { describe, expect, it } from 'vitest';
import type { HassEntities } from 'home-assistant-js-websocket';
import type { RegistryEntity, RegistrySnapshot } from '$lib/core/ha/registry';
import { hassEntity } from '$lib/core/ha/testing';
import {
	DEFAULT_HEARTH_CONFIG,
	isStack,
	takenCardIds,
	type HearthConfig,
	type OverviewCard
} from './config';
import { buildProposal } from './proposal';
import { applyStarter, buildStarter, STARTER_LAYOUTS } from './starterLayouts';

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

const SNAPSHOT: RegistrySnapshot = {
	floors: [],
	areas: [
		{ area_id: 'kitchen', name: 'Kitchen', icon: 'mdi:chef-hat' },
		{ area_id: 'bedroom', name: 'Bedroom' },
		{ area_id: 'office', name: 'Office' }
	],
	devices: [],
	entities: [
		entity('light.kitchen_ceiling', { area_id: 'kitchen' }),
		entity('switch.kettle', { area_id: 'kitchen' }),
		entity('light.bed_left', { area_id: 'bedroom' }),
		entity('cover.bedroom_blind', { area_id: 'bedroom' }),
		entity('camera.crib', { area_id: 'bedroom' }),
		entity('light.desk', { area_id: 'office' }),
		entity('climate.office', { area_id: 'office' }),
		entity('media_player.office', { area_id: 'office' }),
		entity('scene.evening'),
		entity('scene.hidden', { hidden_by: 'user' }),
		entity('lock.front'),
		entity('alarm_control_panel.home'),
		entity('weather.home'),
		entity('calendar.family'),
		entity('sensor.energy')
	]
};

const STATES: HassEntities = Object.fromEntries(
	SNAPSHOT.entities.map(({ entity_id }) => [
		entity_id,
		hassEntity(
			entity_id,
			'on',
			entity_id === 'sensor.energy' ? { device_class: 'energy', unit_of_measurement: 'kWh' } : {}
		)
	])
);

function cards(cardsOf: { room: { cards: (OverviewCard | object)[][] } }): OverviewCard[] {
	return cardsOf.room.cards
		.flat()
		.flatMap((item) => (isStack(item as never) ? [] : [item as OverviewCard]));
}

function build(id: (typeof STARTER_LAYOUTS)[number]['id']) {
	return buildStarter(id, buildProposal(SNAPSHOT, STATES), SNAPSHOT, STATES);
}

describe('buildStarter', () => {
	it('puts the kitchen up front with the scene bar, then a page per other area', () => {
		const plan = build('kitchen');
		expect(plan.pages.map((page) => page.room.name)).toEqual(['Kitchen', 'Bedroom', 'Office']);
		const overview = cards(plan.pages[0]);
		expect(overview[0]).toMatchObject({
			type: 'scenes',
			style: 'bar',
			scenes: [{ entity: 'scene.evening' }]
		});
		expect(overview.some((card) => card.type === 'entities')).toBe(true);
		// the kitchen has no speaker of its own, so the house's first one fills in
		expect(overview.find((card) => card.type === 'media')).toMatchObject({
			entity: 'media_player.office'
		});
		expect(plan.glanceables.map((widget) => widget.type)).toContain('weather');
	});

	it('names every card after its page, so borrowed cards do not clash with the area page', () => {
		const plan = build('kitchen');
		for (const page of plan.pages) {
			for (const card of cards(page)) expect(card.id.startsWith(`${page.room.id}-`)).toBe(true);
		}
	});

	it('folds every area into a collapsed row on one phone page and leaves the rail alone', () => {
		const plan = build('phone');
		expect(plan.pages).toHaveLength(1);
		expect(plan.glanceables).toEqual([]);
		const rows = cards(plan.pages[0]).filter((card) => card.type === 'entities');
		expect(rows.map((row) => row.type === 'entities' && row.title)).toEqual([
			'Bedroom',
			'Kitchen',
			'Office'
		]);
		expect(rows.every((row) => row.type === 'entities' && row.collapsed)).toBe(true);
		const office = rows.find((row) => row.type === 'entities' && row.title === 'Office');
		expect(office?.type === 'entities' && office.entities.map((ref) => ref.entity)).toEqual([
			'light.desk',
			'climate.office'
		]);
	});

	it('builds the bedside page from the bedroom, locks and alarm, without cameras or hidden scenes', () => {
		const plan = build('bedside');
		const page = cards(plan.pages[0]);
		const entities = page.flatMap((card) =>
			card.type === 'entities'
				? card.entities.map((ref) => ref.entity)
				: card.type === 'scenes'
					? card.scenes.map((ref) => ref.entity)
					: []
		);
		expect(entities).toEqual(
			expect.arrayContaining([
				'light.bed_left',
				'cover.bedroom_blind',
				'alarm_control_panel.home',
				'lock.front',
				'scene.evening'
			])
		);
		expect(entities).not.toContain('scene.hidden');
		expect(page.some((card) => card.type === 'camera')).toBe(false);
		expect(plan.glanceables.map((widget) => widget.type)).toEqual(['weather', 'label', 'calendar']);
	});

	it('uses no entity the home does not have', () => {
		const empty: RegistrySnapshot = { floors: [], areas: [], devices: [], entities: [] };
		for (const layout of STARTER_LAYOUTS) {
			expect(buildStarter(layout.id, buildProposal(empty, {}), empty, {}).pages).toEqual([]);
		}
	});
});

describe('applyStarter', () => {
	it('replaces the untouched first page and keeps card ids unique', () => {
		const config: HearthConfig = structuredClone(DEFAULT_HEARTH_CONFIG);
		applyStarter(config, build('kitchen'));
		expect(config.rooms.map((room) => room.name)).toEqual(['Kitchen', 'Bedroom', 'Office']);
		const ids = takenCardIds(config);
		expect(new Set(ids).size).toBe(ids.length);
		expect(config.rail.some((widget) => widget.type === 'weather')).toBe(true);
	});

	it('appends to a dashboard someone has built on, leaving its pages alone', () => {
		const config: HearthConfig = {
			...structuredClone(DEFAULT_HEARTH_CONFIG),
			rooms: [
				{
					id: 'home',
					name: 'Home',
					icon: 'home',
					cards: [[{ id: 'note', type: 'template', content: 'hi' }]]
				}
			]
		};
		applyStarter(config, build('bedside'));
		expect(config.rooms.map((room) => room.name)).toEqual(['Home', 'Bedside']);
		expect(config.rooms[0].cards[0][0].id).toBe('note');
	});
});
