import { describe, expect, it } from 'vitest';
import { headerStatList, normalizeHeaderStats, storedHeaderStats } from './headerStats';

const legacy = { temp_entity: 'sensor.temp', humidity_entity: 'sensor.humidity' };

describe('header readings', () => {
	it('falls back to the temperature and humidity fields', () => {
		expect(headerStatList(legacy)).toEqual([
			{ entity: 'sensor.temp', kind: 'temperature' },
			{ entity: 'sensor.humidity', kind: 'humidity' }
		]);
		expect(headerStatList({ humidity_entity: 'sensor.humidity' })).toEqual([
			{ entity: 'sensor.humidity', kind: 'humidity' }
		]);
		expect(headerStatList(undefined)).toEqual([]);
	});

	it('shows the list in place of the older fields, even when empty', () => {
		const stats = [{ entity: 'sensor.co2', name: 'CO2' }];
		expect(headerStatList({ ...legacy, stats })).toEqual(stats);
		expect(headerStatList({ ...legacy, stats: [] })).toEqual([]);
	});

	it('drops entries without an entity and trims the rest', () => {
		expect(
			normalizeHeaderStats([
				{ entity: ' sensor.co2 ', name: ' CO2 ' },
				{ entity: 'sensor.power', name: '' },
				{ name: 'orphan' },
				'sensor.bare',
				null
			])
		).toEqual([
			{ entity: 'sensor.co2', name: 'CO2' },
			{ entity: 'sensor.power', name: undefined }
		]);
		expect(normalizeHeaderStats(undefined)).toBeUndefined();
		expect(normalizeHeaderStats({ entity: 'sensor.co2' })).toBeUndefined();
	});

	it('keeps the older fields while the rows only repeat them', () => {
		const rows = [
			{ entity: 'sensor.temp', name: '' },
			{ entity: ' sensor.humidity ', name: ' ' },
			{ entity: '', name: 'blank' }
		];
		expect(storedHeaderStats(rows, legacy)).toEqual({ stats: undefined, ...legacy });
		expect(storedHeaderStats([], undefined)).toEqual({
			stats: undefined,
			temp_entity: undefined,
			humidity_entity: undefined
		});
	});

	it('replaces the older fields once the rows change', () => {
		const swapped = [
			{ entity: 'sensor.humidity', name: '' },
			{ entity: 'sensor.temp', name: '' }
		];
		expect(storedHeaderStats(swapped, legacy)).toEqual({
			stats: [
				{ entity: 'sensor.humidity', name: undefined },
				{ entity: 'sensor.temp', name: undefined }
			],
			temp_entity: undefined,
			humidity_entity: undefined
		});
		expect(storedHeaderStats([], legacy).stats).toEqual([]);
		expect(
			storedHeaderStats([{ entity: 'sensor.temp', name: 'Inside' }], {
				stats: [{ entity: 'sensor.temp' }]
			}).stats
		).toEqual([{ entity: 'sensor.temp', name: 'Inside' }]);
	});
});
