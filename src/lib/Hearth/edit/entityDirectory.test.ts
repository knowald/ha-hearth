import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hassEntity } from '$lib/core/ha/testing';
import type { RegistrySnapshot } from '$lib/core/ha/registry';

const fetchRegistry = vi.fn<() => Promise<RegistrySnapshot>>();
vi.mock('$lib/core/ha/registry', () => ({ fetchRegistry: () => fetchRegistry() }));

const {
	entityEntries,
	forgetEntityPlaces,
	loadEntityPlaces,
	matchesQuery,
	orderEntries,
	placesFrom,
	recentEntities,
	rememberEntities,
	stateText,
	topAreas
} = await import('./entityDirectory');

const SNAPSHOT: RegistrySnapshot = {
	floors: [],
	areas: [
		{ area_id: 'office', name: 'Office' },
		{ area_id: 'kitchen', name: 'Kitchen' }
	],
	devices: [
		{ id: 'hub', area_id: 'kitchen', name: 'Zigbee plug', name_by_user: null },
		{ id: 'renamed', area_id: null, name: 'Generic', name_by_user: 'Coffee machine' }
	],
	entities: [
		{
			entity_id: 'light.desk',
			area_id: 'office',
			device_id: null,
			disabled_by: null,
			hidden_by: null
		},
		{
			entity_id: 'switch.plug',
			area_id: null,
			device_id: 'hub',
			disabled_by: null,
			hidden_by: null
		},
		{
			entity_id: 'switch.coffee',
			area_id: null,
			device_id: 'renamed',
			disabled_by: null,
			hidden_by: null
		}
	]
};

const STATES = {
	'light.desk': hassEntity('light.desk', 'on', { friendly_name: 'Desk lamp' }),
	'switch.plug': hassEntity('switch.plug', 'off', { friendly_name: 'Plug' }),
	'switch.coffee': hassEntity('switch.coffee', 'off', { friendly_name: 'Coffee' }),
	'sensor.temperature': hassEntity('sensor.temperature', '21.5', {
		friendly_name: 'Temperature',
		device_class: 'temperature',
		unit_of_measurement: 'C'
	}),
	'sensor.humidity': hassEntity('sensor.humidity', '40', {
		friendly_name: 'Humidity',
		device_class: 'humidity'
	})
};

describe('placesFrom', () => {
	it('takes the area from the entity, else from its device, and prefers the user device name', () => {
		const places = placesFrom(SNAPSHOT);
		expect(places.get('light.desk')).toEqual({ area: 'Office', device: undefined });
		expect(places.get('switch.plug')).toEqual({ area: 'Kitchen', device: 'Zigbee plug' });
		expect(places.get('switch.coffee')).toEqual({ area: undefined, device: 'Coffee machine' });
	});
});

describe('entity search', () => {
	const places = placesFrom(SNAPSHOT);
	const entries = entityEntries(STATES, { places });
	const find = (query: string) =>
		entries.filter((entry) => matchesQuery(entry, query)).map((entry) => entry.entityId);

	it('matches the area name and the device name as well as the name and id', () => {
		expect(find('office')).toEqual(['light.desk']);
		expect(find('zigbee')).toEqual(['switch.plug']);
		expect(find('coffee machine')).toEqual(['switch.coffee']);
		expect(find('desk')).toEqual(['light.desk']);
	});

	it('needs every word to match somewhere', () => {
		expect(find('kitchen plug')).toEqual(['switch.plug']);
		expect(find('kitchen desk')).toEqual([]);
	});

	it('filters by domain and by device class', () => {
		const ids = (options: Parameters<typeof entityEntries>[1]) =>
			entityEntries(STATES, options).map((entry) => entry.entityId);
		expect(ids({ domains: ['switch'] })).toEqual(['switch.plug', 'switch.coffee']);
		expect(ids({ domains: ['sensor'], deviceClass: 'temperature' })).toEqual([
			'sensor.temperature'
		]);
	});

	it('shows the state with its unit', () => {
		expect(stateText(STATES['sensor.temperature'])).toBe('21.5 C');
		expect(stateText(STATES['sensor.humidity'])).toBe('40');
		expect(stateText(undefined)).toBe('');
	});

	it('counts the busiest areas first', () => {
		const extra = entityEntries(
			{ ...STATES, 'light.lamp': hassEntity('light.lamp', 'on') },
			{ places: new Map([...places, ['light.lamp', { area: 'Kitchen' }]]) }
		);
		expect(topAreas(extra)).toEqual(['Kitchen', 'Office']);
		expect(topAreas(extra, 1)).toEqual(['Kitchen']);
	});
});

describe('orderEntries', () => {
	it('puts recent picks first, newest first, only while the query is empty', () => {
		const recent = ['switch.plug', 'sensor.humidity'];
		const entries = entityEntries(STATES, { recent });
		const order = (query: string) =>
			orderEntries(entries, query, recent).map((entry) => entry.entityId);
		expect(order('').slice(0, 3)).toEqual(['switch.plug', 'sensor.humidity', 'switch.coffee']);
		expect(order('s')[0]).toBe('switch.coffee');
	});
});

describe('recent entities', () => {
	beforeEach(() => localStorage.clear());
	afterEach(() => vi.restoreAllMocks());

	it('keeps the newest first, without repeats, up to eight', () => {
		rememberEntities(['light.a', 'light.b']);
		rememberEntities(['light.a']);
		expect(recentEntities()).toEqual(['light.a', 'light.b']);
		rememberEntities(Array.from({ length: 10 }, (_, index) => `light.n${index}`));
		expect(recentEntities()).toHaveLength(8);
		expect(recentEntities()[0]).toBe('light.n9');
	});

	it('ignores a stored value it did not write', () => {
		localStorage.setItem('hearthRecentEntities', '{"not":"a list"}');
		expect(recentEntities()).toEqual([]);
		localStorage.setItem('hearthRecentEntities', 'not json');
		expect(recentEntities()).toEqual([]);
	});

	it('carries on when storage throws', () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('blocked');
		});
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('blocked');
		});
		expect(recentEntities()).toEqual([]);
		expect(() => rememberEntities(['light.desk'])).not.toThrow();
	});
});

describe('loadEntityPlaces', () => {
	beforeEach(() => {
		forgetEntityPlaces();
		fetchRegistry.mockReset();
	});

	it('fetches the registry once and serves later pickers from the cache', async () => {
		fetchRegistry.mockResolvedValue(SNAPSHOT);
		await loadEntityPlaces();
		const places = await loadEntityPlaces();
		expect(fetchRegistry).toHaveBeenCalledTimes(1);
		expect(places.get('light.desk')?.area).toBe('Office');
	});

	it('tries again after a failed fetch', async () => {
		fetchRegistry.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(SNAPSHOT);
		await expect(loadEntityPlaces()).rejects.toThrow('offline');
		await expect(loadEntityPlaces()).resolves.toBeInstanceOf(Map);
		expect(fetchRegistry).toHaveBeenCalledTimes(2);
	});
});
