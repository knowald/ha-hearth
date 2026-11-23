import { describe, expect, it } from 'vitest';
import type { StatisticRow } from '$lib/core/ha/history';
import {
	barRects,
	chartBucket,
	chartData,
	chartScale,
	hasValues,
	linePoints,
	nearestBucket,
	niceScale,
	rowValue,
	tickDecimals,
	tickLabel,
	type NiceScale
} from './series';

const HOUR = 3600 * 1000;
const START = Date.UTC(2026, 10, 16, 12);

function rows(values: (number | null)[], fields: (value: number) => Partial<StatisticRow>) {
	return values.flatMap((value, index): StatisticRow[] =>
		value === null
			? []
			: [{ start: START + index * HOUR, end: START + (index + 1) * HOUR, ...fields(value) }]
	);
}

const mean = (value: number) => ({ mean: value });

describe('chartBucket', () => {
	it('draws a day by the hour and a month by the day', () => {
		expect(chartBucket('line', 'day')).toBe('hour');
		expect(chartBucket('bar', 'day')).toBe('hour');
		expect(chartBucket('line', 'month')).toBe('day');
		expect(chartBucket('bar', 'month')).toBe('day');
	});

	it('draws a week of lines by the hour and a week of bars by the day', () => {
		expect(chartBucket('line', 'week')).toBe('hour');
		expect(chartBucket('bar', 'week')).toBe('day');
	});
});

describe('rowValue', () => {
	it('follows the mean on a line and falls back to the state', () => {
		expect(rowValue({ start: 0, end: 1, mean: 2, state: 9 }, 'line')).toBe(2);
		expect(rowValue({ start: 0, end: 1, state: 9, change: 3 }, 'line')).toBe(9);
	});

	it('shows the change on a bar, negative included, and falls back to the mean', () => {
		expect(rowValue({ start: 0, end: 1, mean: 2, change: -1.5 }, 'bar')).toBe(-1.5);
		expect(rowValue({ start: 0, end: 1, mean: 2 }, 'bar')).toBe(2);
		expect(rowValue({ start: 0, end: 1, change: 0, mean: 2 }, 'bar')).toBe(0);
	});

	it('has no value for a row without one', () => {
		expect(rowValue({ start: 0, end: 1 }, 'line')).toBeNull();
		expect(rowValue({ start: 0, end: 1, mean: NaN }, 'line')).toBeNull();
	});
});

describe('chartData', () => {
	it('shares one bucket list between series and keeps their order', () => {
		const data = chartData(
			{
				'sensor.b': rows([null, 5, 6], mean),
				'sensor.a': rows([1, 2, null, 4], mean)
			},
			['sensor.a', 'sensor.b', 'sensor.missing'],
			'line'
		);
		expect(data.buckets.map((bucket) => (bucket.start - START) / HOUR)).toEqual([0, 1, 2, 3]);
		expect(data.values).toEqual([
			[1, 2, null, 4],
			[null, 5, 6, null],
			[null, null, null, null]
		]);
		expect(hasValues(data)).toBe(true);
	});

	it('has nothing to draw without rows', () => {
		const data = chartData({}, ['sensor.a'], 'line');
		expect(data.buckets).toEqual([]);
		expect(hasValues(data)).toBe(false);
	});
});

describe('linePoints', () => {
	it('places points by time and breaks the line where no row covers the time', () => {
		const data = chartData({ 'sensor.a': rows([1, 2, null, 4, 5], mean) }, ['sensor.a'], 'line');
		expect(linePoints(data, 0)).toEqual([
			{ x: START, y: 1 },
			{ x: START + HOUR, y: 2 },
			{ x: START + 2 * HOUR, y: null },
			{ x: START + 3 * HOUR, y: 4 },
			{ x: START + 4 * HOUR, y: 5 }
		]);
	});

	it('breaks the line where another series has a bucket this one lacks', () => {
		const data = chartData(
			{ 'sensor.a': rows([1, null, 3], mean), 'sensor.b': rows([1, 2, 3], mean) },
			['sensor.a', 'sensor.b'],
			'line'
		);
		expect(linePoints(data, 0).map((point) => point.y)).toEqual([1, null, 3]);
	});
});

describe('niceScale', () => {
	it('rounds the domain out to even ticks', () => {
		expect(niceScale(18.4, 23.7)).toEqual({ domain: [18, 24], ticks: [18, 20, 22, 24], step: 2 });
		expect(niceScale(0, 11.2).ticks).toEqual([0, 5, 10, 15]);
	});

	it('keeps small steps exact', () => {
		expect(niceScale(0.1, 0.35)).toMatchObject({ step: 0.1, ticks: [0.1, 0.2, 0.3, 0.4] });
	});

	it('gives a flat series room, and a flat zero room above only', () => {
		expect(niceScale(20, 20).domain[0]).toBeLessThan(20);
		expect(niceScale(20, 20).domain[1]).toBeGreaterThan(20);
		expect(niceScale(0, 0).domain).toEqual([0, 1]);
	});

	it('falls back to 0 to 1 for a domain that is not finite', () => {
		expect(niceScale(NaN, 4).domain).toEqual([0, 1]);
	});

	// a scale the plot can draw: a few distinct finite ticks in order, inside a
	// finite domain that holds both ends of the data
	function expectUsable(scale: NiceScale, low: number, high: number) {
		expect(scale.ticks.length).toBeGreaterThanOrEqual(2);
		expect(scale.ticks.length).toBeLessThanOrEqual(12);
		for (const value of [...scale.ticks, ...scale.domain, scale.step]) {
			expect(Number.isFinite(value)).toBe(true);
		}
		for (let index = 1; index < scale.ticks.length; index += 1) {
			expect(scale.ticks[index]).toBeGreaterThan(scale.ticks[index - 1]);
		}
		expect(scale.domain[0]).toBeLessThanOrEqual(low);
		expect(scale.domain[1]).toBeGreaterThanOrEqual(high);
		expect(scale.domain[1]).toBeGreaterThan(scale.domain[0]);
	}

	it('returns for a span below what a double can divide', () => {
		expectUsable(niceScale(1, 1.0000000000000002), 1, 1.0000000000000002);
		expectUsable(niceScale(1e-323, 2e-323), 1e-323, 2e-323);
	});

	it('gives distinct ticks for two large neighbouring values', () => {
		const scale = niceScale(1000000000000, 1000000000001);
		expectUsable(scale, 1000000000000, 1000000000001);
		expect(new Set(scale.ticks.map((tick) => tickLabel(tick, scale.step))).size).toBe(
			scale.ticks.length
		);
	});

	it('stays finite at the ends of the double range', () => {
		expectUsable(niceScale(-1e308, 1e308), -1e308, 1e308);
		expectUsable(niceScale(1.7e308, 1.7e308), 1.7e308, 1.7e308);
		expectUsable(niceScale(-1.7e308, -1.7e308), -1.7e308, -1.7e308);
	});

	it('takes the ends in either order', () => {
		expect(niceScale(23.7, 18.4).ticks).toEqual([18, 20, 22, 24]);
	});
});

describe('tick labels', () => {
	it('tells tiny steps apart in plain notation', () => {
		const scale = niceScale(1e-8, 4e-8);
		const labels = scale.ticks.map((tick) => tickLabel(tick, scale.step));
		expect(new Set(labels).size).toBe(labels.length);
		for (const label of labels) expect(label).toMatch(/^-?\d+(\.\d+)?$/);
		expect(labels).toContain('0.00000002');
	});

	it('writes whole ticks bare and halves to one decimal', () => {
		expect(tickDecimals(2)).toBe(0);
		expect(tickDecimals(0.5)).toBe(1);
		expect(tickDecimals(0.05)).toBe(2);
		expect(tickLabel(20, 2)).toBe('20');
		expect(tickLabel(1.5, 0.5)).toBe('1.5');
		expect(tickLabel(-0, 1)).toBe('0');
	});

	it('writes ticks near the largest doubles without exponent noise or Infinity', () => {
		const label = tickLabel(1e308, 1e308);
		expect(label).not.toContain('Infinity');
		expect(label.length).toBeGreaterThan(0);
	});
});

describe('chartScale', () => {
	it('keeps zero in a bar chart and spans negative values', () => {
		const data = chartData(
			{ 'sensor.a': rows([3, -2, 5], (value) => ({ change: value })) },
			['sensor.a'],
			'bar'
		);
		const scale = chartScale(data, 'bar', [START, START + 3 * HOUR]);
		expect(scale.domain.y[0]).toBeLessThanOrEqual(-2);
		expect(scale.domain.y[1]).toBeGreaterThanOrEqual(5);
		expect(scale.ticks).toContain(0);
	});

	it('does not force zero into a line chart', () => {
		const data = chartData({ 'sensor.a': rows([20, 22], mean) }, ['sensor.a'], 'line');
		expect(chartScale(data, 'line', [START, START + 2 * HOUR]).domain.y[0]).toBeGreaterThan(0);
	});

	it('widens time to the end of the last bar', () => {
		const data = chartData({ 'sensor.a': rows([1, 2], mean) }, ['sensor.a'], 'bar');
		const now = START + HOUR + HOUR / 2;
		expect(chartScale(data, 'bar', [START, now]).domain.x).toEqual([START, START + 2 * HOUR]);
		expect(chartScale(data, 'line', [START, now]).domain.x).toEqual([START, now]);
	});
});

describe('barRects', () => {
	const box = { width: 100, height: 100, pad: 0 };

	it('grows positive bars up and negative bars down from zero', () => {
		const data = chartData(
			{ 'sensor.a': rows([5, -5], (value) => ({ change: value })) },
			['sensor.a'],
			'bar'
		);
		const domain = {
			x: [START, START + 2 * HOUR] as [number, number],
			y: [-10, 10] as [number, number]
		};
		const [up, down] = barRects(data, domain, box, START + 2 * HOUR);
		expect(up).toMatchObject({ y: 25, height: 25, current: false });
		expect(down).toMatchObject({ y: 50, height: 25 });
		expect(up.x).toBeCloseTo(7.5);
		expect(up.width).toBeCloseTo(35);
	});

	it('sets bars of several series side by side and leaves out missing values', () => {
		const data = chartData(
			{
				'sensor.a': rows([4, 4], (value) => ({ change: value })),
				'sensor.b': rows([null, 2], (value) => ({ change: value }))
			},
			['sensor.a', 'sensor.b'],
			'bar'
		);
		const domain = {
			x: [START, START + 2 * HOUR] as [number, number],
			y: [0, 4] as [number, number]
		};
		const bars = barRects(data, domain, box, START + HOUR + 1);
		expect(bars.map((bar) => [bar.series, bar.bucket])).toEqual([
			[0, 0],
			[0, 1],
			[1, 1]
		]);
		const [, second, third] = bars;
		expect(third.x).toBeGreaterThan(second.x);
		expect(third.current).toBe(true);
	});

	it('keeps a hairline for a value too small to show', () => {
		const data = chartData(
			{ 'sensor.a': rows([0.0001], (value) => ({ change: value })) },
			['sensor.a'],
			'bar'
		);
		const domain = {
			x: [START, START + HOUR] as [number, number],
			y: [0, 100] as [number, number]
		};
		expect(barRects(data, domain, box, START + HOUR)[0]).toMatchObject({ y: 99, height: 1 });
	});
});

describe('nearestBucket', () => {
	it('picks the bucket closest to a time, a bar by its middle', () => {
		const data = chartData({ 'sensor.a': rows([1, 2, 3], mean) }, ['sensor.a'], 'line');
		expect(nearestBucket(data, 'line', START + 0.4 * HOUR)).toBe(0);
		expect(nearestBucket(data, 'line', START + 0.6 * HOUR)).toBe(1);
		expect(nearestBucket(data, 'bar', START + 0.9 * HOUR)).toBe(0);
		expect(nearestBucket(data, 'line', START + 99 * HOUR)).toBe(2);
		expect(nearestBucket(chartData({}, [], 'line'), 'line', START)).toBe(-1);
	});
});
