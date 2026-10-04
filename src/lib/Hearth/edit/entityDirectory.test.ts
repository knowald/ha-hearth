import type { Connection } from 'home-assistant-js-websocket';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connection } from '$lib/core/ha/connection';
import { hassEntity } from '$lib/core/ha/testing';
import type { DisplayRegistry } from '$lib/core/ha/registry';

const fetchDisplayRegistry = vi.fn<(conn: Connection) => Promise<DisplayRegistry>>();
vi.mock('$lib/core/ha/registry', () => ({
	fetchDisplayRegistry: (conn: Connection) => fetchDisplayRegistry(conn)
}));

const {
	REGISTRY_TIMEOUT_MS,
	entityEntries,
	entryBuilder,
	fitsDeviceClass,
	forgetEntityPlaces,
	loadEntityPlaces,
	matchesQuery,
	orderEntries,
	placesFrom,
	queryWords,
	recentEntities,
	rememberEntities,
	topAreas
} = await import('./entityDirectory');

const REGISTRY: DisplayRegistry = {
	areas: [
		{ area_id: 'office', name: 'Office' },
		{ area_id: 'kitchen', name: 'Kitchen' }
	],
	devices: [
		{ id: 'hub', area_id: 'kitchen', name: 'Zigbee plug', name_by_user: null },
		{ id: 'renamed', area_id: null, name: 'Generic', name_by_user: 'Coffee machine' }
	],
	entities: [
		{ entity_id: 'light.desk', area_id: 'office', device_id: null },
		{ entity_id: 'switch.plug', area_id: null, device_id: 'hub' },
		{ entity_id: 'switch.coffee', area_id: null, device_id: 'renamed' }
	]
};

const STATES = {
	'light.desk': hassEntity('light.desk', 'on', { friendly_name: 'Desk lamp' }),
	'switch.plug': hassEntity('switch.plug', 'off', { friendly_name: 'Plug' }),
	'switch.coffee': hassEntity('switch.coffee', 'off', { friendly_name: 'Coffee' }),
	'sensor.temperature': hassEntity('sensor.temperature', '21.5', {
		friendly_name: 'Temperature',
		device_class: 'temperature',
		unit_of_measurement: '\u00b0C'
	}),
	'sensor.humidity': hassEntity('sensor.humidity', '40', {
		friendly_name: 'Humidity',
		device_class: 'humidity'
	}),
	// a template sensor: no device_class, only a unit
	'sensor.attic': hassEntity('sensor.attic', '18', {
		friendly_name: 'Attic',
		unit_of_measurement: '\u00b0C'
	})
};

const fakeConnection = () => ({}) as Connection;

describe('placesFrom', () => {
	it('takes the area from the entity, else from its device, and prefers the user device name', () => {
		const places = placesFrom(REGISTRY);
		expect(places.get('light.desk')).toEqual({
			areaId: 'office',
			area: 'Office',
			device: undefined
		});
		expect(places.get('switch.plug')).toEqual({
			areaId: 'kitchen',
			area: 'Kitchen',
			device: 'Zigbee plug'
		});
		expect(places.get('switch.coffee')).toEqual({
			areaId: undefined,
			area: undefined,
			device: 'Coffee machine'
		});
	});
});

describe('entity search', () => {
	const build = entryBuilder(placesFrom(REGISTRY));
	const entries = entityEntries(STATES, { build });
	const find = (query: string) =>
		entries
			.filter((entry) => matchesQuery(entry, queryWords(query)))
			.map((entry) => entry.entityId);

	it('matches the area name and the device name as well as the name and id', () => {
		expect(find('office')).toEqual(['light.desk']);
		expect(find('zigbee')).toEqual(['switch.plug']);
		expect(find('coffee machine')).toEqual(['switch.coffee']);
		expect(find('DESK')).toEqual(['light.desk']);
	});

	it('needs every word to match somewhere', () => {
		expect(find('kitchen plug')).toEqual(['switch.plug']);
		expect(find('kitchen desk')).toEqual([]);
	});

	it('reuses the row of an entity whose state object did not change', () => {
		const again = entityEntries({ ...STATES }, { build });
		const desk = (list: typeof entries) => list.find((entry) => entry.entityId === 'light.desk');
		expect(desk(again)?.haystack).toBe(desk(entries)?.haystack);
		const changed = entityEntries(
			{ ...STATES, 'light.desk': hassEntity('light.desk', 'off', { friendly_name: 'Lamp' }) },
			{ build }
		);
		expect(desk(changed)?.name).toBe('Lamp');
	});

	it('knows when the name is only the id', () => {
		const [entry] = entityEntries({ 'light.bare': hassEntity('light.bare', 'on') }, {});
		expect(entry).toMatchObject({ name: 'light.bare', named: false });
	});

	it('filters by domain', () => {
		expect(entityEntries(STATES, { domains: ['switch'] }).map((entry) => entry.entityId)).toEqual([
			'switch.plug',
			'switch.coffee'
		]);
	});

	it('counts the busiest areas and lists them by name', () => {
		const extra = entityEntries(
			{ ...STATES, 'light.lamp': hassEntity('light.lamp', 'on') },
			{
				build: entryBuilder(
					new Map([...placesFrom(REGISTRY), ['light.lamp', { areaId: 'kitchen', area: 'Kitchen' }]])
				)
			}
		);
		expect(topAreas(extra)).toEqual([
			{ id: 'kitchen', name: 'Kitchen' },
			{ id: 'office', name: 'Office' }
		]);
		expect(topAreas(extra, 1)).toEqual([{ id: 'kitchen', name: 'Kitchen' }]);
	});
});

describe('device class', () => {
	it('fits by device_class, or by unit when a sensor declares none', () => {
		expect(fitsDeviceClass(STATES['sensor.temperature'], 'temperature')).toBe(true);
		expect(fitsDeviceClass(STATES['sensor.attic'], 'temperature')).toBe(true);
		expect(fitsDeviceClass(STATES['sensor.humidity'], 'temperature')).toBe(false);
		expect(fitsDeviceClass(STATES['sensor.attic'], 'humidity')).toBe(false);
		expect(fitsDeviceClass(STATES['switch.plug'], undefined)).toBe(true);
	});

	it('lists fitting sensors first without hiding the rest', () => {
		const entries = entityEntries(STATES, { domains: ['sensor'], deviceClass: 'temperature' });
		expect(orderEntries(entries, '', []).map((entry) => entry.entityId)).toEqual([
			'sensor.attic',
			'sensor.temperature',
			'sensor.humidity'
		]);
	});
});

describe('orderEntries', () => {
	it('puts recent picks first, newest first, only while the query is empty', () => {
		const recent = ['switch.plug', 'sensor.humidity'];
		const entries = entityEntries(STATES, { recent });
		const order = (query: string) =>
			orderEntries(entries, query, recent).map((entry) => entry.entityId);
		expect(order('').slice(0, 3)).toEqual(['switch.plug', 'sensor.humidity', 'sensor.attic']);
		expect(order('s')[0]).toBe('sensor.attic');
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
		fetchDisplayRegistry.mockReset();
		connection.set(fakeConnection());
	});

	afterEach(() => {
		vi.useRealTimers();
		connection.set(undefined);
	});

	it('fetches the registry once and serves later pickers from the cache', async () => {
		fetchDisplayRegistry.mockResolvedValue(REGISTRY);
		await loadEntityPlaces();
		const places = await loadEntityPlaces();
		expect(fetchDisplayRegistry).toHaveBeenCalledTimes(1);
		expect(places.get('light.desk')?.area).toBe('Office');
	});

	it('fetches again on a new connection', async () => {
		fetchDisplayRegistry.mockResolvedValue(REGISTRY);
		await loadEntityPlaces();
		connection.set(fakeConnection());
		await loadEntityPlaces();
		expect(fetchDisplayRegistry).toHaveBeenCalledTimes(2);
	});

	it('tries again after a failed fetch', async () => {
		fetchDisplayRegistry.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(REGISTRY);
		await expect(loadEntityPlaces()).rejects.toThrow('offline');
		await expect(loadEntityPlaces()).resolves.toBeInstanceOf(Map);
		expect(fetchDisplayRegistry).toHaveBeenCalledTimes(2);
	});

	it('gives up on a stalled fetch and tries again next time', async () => {
		vi.useFakeTimers();
		fetchDisplayRegistry.mockReturnValueOnce(new Promise(() => {})).mockResolvedValue(REGISTRY);
		const stalled = loadEntityPlaces();
		const failure = expect(stalled).rejects.toThrow(/timed out/);
		await vi.advanceTimersByTimeAsync(REGISTRY_TIMEOUT_MS);
		await failure;
		await expect(loadEntityPlaces()).resolves.toBeInstanceOf(Map);
		expect(fetchDisplayRegistry).toHaveBeenCalledTimes(2);
	});

	it('rejects without a connection', async () => {
		connection.set(undefined);
		await expect(loadEntityPlaces()).rejects.toThrow();
		expect(fetchDisplayRegistry).not.toHaveBeenCalled();
	});
});
