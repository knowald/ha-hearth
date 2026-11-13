import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { hearthConfigIssues, normalizeHearthConfig } from '../../normalize';
import { gaugeBands, gaugeCard, gaugeFraction, gaugeSegment } from './gauge';

function withCard(card: Record<string, unknown>) {
	return {
		version: 5,
		rail: [],
		rooms: [{ id: 'home', name: 'Home', cards: [[{ id: 'gauge', type: 'gauge', ...card }]] }]
	};
}

const SEGMENTS = [
	{ from: 0, color: 'bad' },
	{ from: 20, color: 'accent' },
	{ from: 50, color: 'good' }
];

describe('gaugeFraction', () => {
	it('places a value between min and max', () => {
		expect(gaugeFraction(54, 0, 100)).toBe(0.54);
		expect(gaugeFraction(2.4, 0, 6)).toBeCloseTo(0.4);
		expect(gaugeFraction(-5, -10, 10)).toBe(0.25);
	});

	it('clamps a value outside the range', () => {
		expect(gaugeFraction(140, 0, 100)).toBe(1);
		expect(gaugeFraction(-3, 0, 100)).toBe(0);
	});

	it('is 0 for a range with min equal to or above max', () => {
		expect(gaugeFraction(5, 10, 10)).toBe(0);
		expect(gaugeFraction(5, 10, 0)).toBe(0);
	});

	it('is 0 for a missing or non-finite input', () => {
		expect(gaugeFraction(null, 0, 100)).toBe(0);
		expect(gaugeFraction(NaN, 0, 100)).toBe(0);
		expect(gaugeFraction(Infinity, 0, 100)).toBe(0);
		expect(gaugeFraction(50, -Infinity, 100)).toBe(0);
	});
});

describe('gaugeSegment', () => {
	it('has no segment below the first start', () => {
		expect(gaugeSegment([{ from: 10, color: 'good' }], 5)).toBeUndefined();
	});

	it('takes the segment that starts exactly at the value', () => {
		expect(gaugeSegment(SEGMENTS, 20)?.color).toBe('accent');
		expect(gaugeSegment(SEGMENTS, 19.9)?.color).toBe('bad');
		expect(gaugeSegment(SEGMENTS, 500)?.color).toBe('good');
	});

	it('reads unsorted segments by their start', () => {
		const unsorted = [SEGMENTS[2], SEGMENTS[0], SEGMENTS[1]];
		expect(gaugeSegment(unsorted, 30)?.color).toBe('accent');
		expect(gaugeSegment(unsorted, 60)?.color).toBe('good');
	});

	it('lets the later listed of two equal starts win', () => {
		const duplicate = [
			{ from: 10, color: 'good' },
			{ from: 10, color: 'bad' }
		];
		expect(gaugeSegment(duplicate, 12)?.color).toBe('bad');
	});

	it('has no segment for a missing or non-finite value', () => {
		expect(gaugeSegment(SEGMENTS, null)).toBeUndefined();
		expect(gaugeSegment(SEGMENTS, NaN)).toBeUndefined();
		expect(gaugeSegment(undefined, 10)).toBeUndefined();
		expect(gaugeSegment([{ from: NaN, color: 'bad' }], 10)).toBeUndefined();
	});
});

describe('gaugeBands', () => {
	it('spans each segment to the start of the next', () => {
		expect(
			gaugeBands(SEGMENTS, 0, 100).map(({ start, end, segment }) => [start, end, segment.color])
		).toEqual([
			[0, 0.2, 'bad'],
			[0.2, 0.5, 'accent'],
			[0.5, 1, 'good']
		]);
	});

	it('drops segments clamped to nothing and empty ranges', () => {
		const bands = gaugeBands(
			[
				{ from: 10, color: 'good' },
				{ from: 10, color: 'bad' },
				{ from: 150, color: 'accent' }
			],
			0,
			100
		);
		expect(bands.map((band) => band.segment.color)).toEqual(['bad']);
		expect(gaugeBands(SEGMENTS, 100, 0)).toEqual([]);
	});
});

describe('gauge card definition', () => {
	it('keeps a configured gauge and sorts its segments', () => {
		const config = normalizeHearthConfig(
			withCard({
				entity: ' sensor.battery ',
				name: 'Phone',
				min: 0,
				max: 100,
				needle: true,
				segments: [
					{ from: 50, color: 'good' },
					{ from: 0, color: 'bad' }
				]
			})
		);
		expect(config.rooms[0].cards[0][0]).toMatchObject({
			entity: 'sensor.battery',
			name: 'Phone',
			needle: true,
			segments: [
				{ from: 0, color: 'bad' },
				{ from: 50, color: 'good' }
			]
		});
	});

	it('falls back to 0 and 100 for a reversed or empty range', () => {
		expect(gaugeCard.normalize({ min: 10, max: 5 })).toMatchObject({
			min: undefined,
			max: undefined
		});
		expect(gaugeCard.normalize({ min: 100 })).toMatchObject({ min: undefined, max: undefined });
		expect(gaugeCard.normalize({ min: -20, max: 40 })).toMatchObject({ min: -20, max: 40 });
	});

	it('coerces unusable values to unset', () => {
		expect(
			gaugeCard.normalize({
				entity: 42,
				min: 'low',
				max: Infinity,
				needle: 'yes',
				segments: [{ from: 'x', color: 'bad' }, { from: 3 }, 'red', { from: 5, color: ' good ' }]
			})
		).toEqual({
			entity: undefined,
			name: undefined,
			unit: undefined,
			min: undefined,
			max: undefined,
			needle: undefined,
			segments: [{ from: 5, color: 'good' }]
		});
		expect(gaugeCard.normalize({ segments: [] }).segments).toBeUndefined();
	});

	it('reports a range with min at or above max', () => {
		expect(hearthConfigIssues(withCard({ entity: 'sensor.x', min: 100 }))).toEqual([
			expect.stringContaining('min must be below max')
		]);
		expect(v.safeParse(gaugeCard.schema, { min: 0, max: 10 }).success).toBe(true);
		expect(v.safeParse(gaugeCard.schema, { segments: [{ from: 1 }] }).success).toBe(false);
	});

	it('drafts a sensor, preferring one that reads in percent', () => {
		expect(
			gaugeCard.draft?.({
				entityIds: ['light.desk', 'sensor.power', 'sensor.humidity'],
				pageName: 'Home'
			})
		).toEqual({ entity: 'sensor.humidity' });
		expect(
			gaugeCard.draft?.({ entityIds: ['light.desk', 'sensor.power'], pageName: 'Home' })
		).toEqual({ entity: 'sensor.power' });
		expect(gaugeCard.draft?.({ entityIds: ['light.desk'], pageName: 'Home' })).toBeUndefined();
	});

	it('needs an entity', () => {
		expect(gaugeCard.needsConfiguration({ id: 'g', type: 'gauge' })).toBe(true);
		expect(gaugeCard.needsConfiguration({ id: 'g', type: 'gauge', entity: 'sensor.x' })).toBe(
			false
		);
	});
});
