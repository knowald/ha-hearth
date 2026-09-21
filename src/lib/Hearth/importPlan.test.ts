import { describe, expect, it } from 'vitest';
import { DEFAULT_HEARTH_CONFIG, type HearthConfig, type RailWidget } from './config';
import { applyImport, mergeGlanceables } from './importPlan';
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
