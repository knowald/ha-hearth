import { describe, expect, it } from 'vitest';
import { DEFAULT_HEARTH_CONFIG, type HearthConfig, type RailWidget } from './config';
import { applyImport, mergeGlanceables, mergeNewEntities, newEntityIds } from './importPlan';
import type { ProposedPage } from './proposal';

function page(id: string, name = id): ProposedPage {
	return {
		areaId: id,
		room: {
			id,
			name,
			icon: 'meeting_room',
			cards: [[{ id: `${id}-lighting`, type: 'entities', entities: [{ entity: 'light.a' }] }]]
		},
		counts: { lights: 1, covers: 0, climate: 0, media: 0, cameras: 0, devices: 0 }
	};
}

function config(...rooms: HearthConfig['rooms']): HearthConfig {
	const base = structuredClone(DEFAULT_HEARTH_CONFIG);
	return rooms.length ? { ...base, rooms } : base;
}

const GLANCEABLES: RailWidget[] = [
	{ id: 'today-weather', type: 'weather', entity: 'weather.home' },
	{ id: 'today-label', type: 'label', text: 'TODAY' },
	{ id: 'today-energy', type: 'energy', entity: 'sensor.energy' }
];

describe('applyImport', () => {
	it('keeps the first page and drops the rest when replacing', () => {
		const draft = config(
			{ id: 'home', name: 'Home', icon: 'home', cards: [[]] },
			{ id: 'old', name: 'Old', icon: 'home', cards: [[]] }
		);

		applyImport(draft, { pages: [page('kitchen', 'Kitchen')], mode: 'replace' });

		expect(draft.rooms.map((room) => room.id)).toEqual(['home', 'kitchen']);
	});

	it('appends only pages the dashboard does not already have when adding', () => {
		const draft = config(
			{ id: 'home', name: 'Home', icon: 'home', cards: [[]] },
			{ id: 'kitchen', name: 'kitchen ', icon: 'home', cards: [[]] }
		);

		applyImport(draft, {
			pages: [page('kitchen', 'Kitchen'), page('office', 'Office')],
			mode: 'add'
		});

		expect(draft.rooms.map((room) => room.id)).toEqual(['home', 'kitchen', 'office']);
	});

	it('renames an imported page that collides with a kept one, cards included', () => {
		const draft = config({ id: 'kitchen', name: 'Cooking', icon: 'home', cards: [[]] });

		applyImport(draft, { pages: [page('kitchen', 'Kitchen')], mode: 'replace' });

		expect(draft.rooms[1].id).toBe('kitchen-2');
		expect(draft.rooms[1].cards[0][0].id).toBe('kitchen-2-lighting');
	});
});

describe('mergeGlanceables', () => {
	it('inserts above the trailing flexible spacer', () => {
		const draft = config();

		mergeGlanceables(draft, GLANCEABLES);

		expect(draft.rail.map((widget) => widget.id)).toEqual([
			'clock',
			'divider',
			'nav',
			'today-weather',
			'today-label',
			'today-energy',
			'spacer'
		]);
	});

	it('is a no-op on a second run, label included', () => {
		const draft = config();

		mergeGlanceables(draft, GLANCEABLES);
		const afterFirst = structuredClone(draft.rail);
		mergeGlanceables(draft, GLANCEABLES);

		expect(draft.rail).toEqual(afterFirst);
	});

	it('leaves out a label whose group is already on the rail', () => {
		const draft = config();
		draft.rail = [{ id: 'energy', type: 'energy', entity: 'sensor.other' }];

		mergeGlanceables(draft, GLANCEABLES);

		expect(draft.rail.map((widget) => widget.type)).toEqual(['energy', 'weather']);
	});
});

/** An Office area page as the import proposes it, with grids and a thermostat. */
function officeProposal(): ProposedPage {
	return {
		areaId: 'office',
		room: {
			id: 'office',
			name: 'Office',
			icon: 'desk',
			cards: [
				[
					{
						id: 'office-lighting',
						type: 'entities',
						title: 'Lighting',
						entities: [{ entity: 'light.desk' }, { entity: 'light.lamp' }]
					},
					{
						id: 'office-devices',
						type: 'entities',
						title: 'Devices',
						entities: [{ entity: 'switch.fan' }, { entity: 'fan.tower' }]
					}
				],
				[{ id: 'office-climate', type: 'climate', entity: 'climate.office' }]
			]
		},
		counts: { lights: 2, covers: 0, climate: 1, media: 0, cameras: 0, devices: 2 }
	};
}

function officePage(): HearthConfig['rooms'][number] {
	return {
		id: 'office',
		name: 'Office',
		icon: 'desk',
		cards: [
			[
				{
					id: 'lights',
					type: 'entities',
					title: 'Lights',
					entities: [{ entity: 'light.desk', name: 'Desk' }, { entity: 'switch.fan' }]
				},
				{ id: 'note', type: 'template', content: 'hello' }
			]
		]
	};
}

describe('newEntityIds', () => {
	it('lists what the area proposes and the page does not show', () => {
		expect(newEntityIds(officePage(), officeProposal())).toEqual([
			'light.lamp',
			'fan.tower',
			'climate.office'
		]);
	});
});

describe('mergeNewEntities', () => {
	it('adds tiles to the grid holding their domain and new cards for the rest', () => {
		const room = officePage();
		const taken = ['lights', 'note'];

		expect(mergeNewEntities(room, officeProposal(), taken)).toBe(3);

		const [column] = room.cards;
		// the existing grid keeps its order and its own names; the light joins it
		expect(column[0]).toMatchObject({
			id: 'lights',
			entities: [
				{ entity: 'light.desk', name: 'Desk' },
				{ entity: 'switch.fan' },
				{ entity: 'light.lamp' }
			]
		});
		expect(column[1]).toEqual({ id: 'note', type: 'template', content: 'hello' });
		// no grid holds a fan yet, so it arrives in a copy of the proposed one
		expect(column[2]).toMatchObject({
			id: 'office-devices',
			title: 'Devices',
			entities: [{ entity: 'fan.tower' }]
		});
		// a one-column page takes the thermostat in its only column
		expect(column[3]).toMatchObject({ id: 'office-climate', entity: 'climate.office' });
	});

	it('adds nothing on a second run', () => {
		const room = officePage();
		mergeNewEntities(room, officeProposal(), []);
		const once = structuredClone(room);

		expect(mergeNewEntities(room, officeProposal(), [])).toBe(0);
		expect(room).toEqual(once);
	});

	it('gives new cards ids no other card has', () => {
		const room = officePage();
		mergeNewEntities(room, officeProposal(), ['office-devices']);

		expect(room.cards[0].map((card) => card.id)).toContain('office-devices-2');
	});
});

describe('applyImport in merge mode', () => {
	it('fills existing pages and adds pages for new areas, leaving the rest alone', () => {
		const draft = config({ id: 'home', name: 'Home', icon: 'home', cards: [[]] }, officePage());

		applyImport(draft, { pages: [officeProposal(), page('kitchen', 'Kitchen')], mode: 'merge' });

		expect(draft.rooms.map((room) => room.id)).toEqual(['home', 'office', 'kitchen']);
		expect(draft.rooms[0].cards).toEqual([[]]);
		expect(newEntityIds(draft.rooms[1], officeProposal())).toEqual([]);
	});
});
