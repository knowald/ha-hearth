import { describe, expect, it } from 'vitest';
import type { StatisticRow } from '$lib/core/ha/history';
import { belowWeekAverage, compareWithWeek } from './average';

const HOUR = 60 * 60 * 1000;
// local time, like the widget's day boundaries
const NOW = new Date(2026, 9, 4, 9, 20);
const TODAY = new Date(2026, 9, 4).getTime();

function day(back: number) {
	return new Date(2026, 9, 4 - back).getTime();
}

/** Hourly rows for one day from midnight; `perHour(hour)` is the kWh used that hour. */
function rows(start: number, hours: number, perHour: (hour: number) => number): StatisticRow[] {
	return Array.from({ length: hours }, (_, hour) => ({
		start: start + hour * HOUR,
		end: start + (hour + 1) * HOUR,
		change: perHour(hour)
	}));
}

function week(perHour: (back: number, hour: number) => number) {
	return [1, 2, 3, 4, 5, 6, 7]
		.reverse()
		.flatMap((back) => rows(day(back), 24, (hour) => perHour(back, hour)));
}

describe('compareWithWeek', () => {
	it('compares today so far with the same hours of each earlier day', () => {
		// 9 finished hours today at 0.5 kWh; earlier days use 1 kWh an hour, 2 after 9:00
		const history = [...week((_, hour) => (hour < 9 ? 1 : 2)), ...rows(TODAY, 9, () => 0.5)];
		expect(compareWithWeek(history, NOW)).toEqual({ today: 4.5, average: 9 });
		expect(belowWeekAverage(compareWithWeek(history, NOW))).toBe(true);
	});

	it('averages days that differ', () => {
		const history = [...week((back) => back), ...rows(TODAY, 9, () => 5)];
		// 9 hours at 1..7 kWh: 9 * 4 on average
		expect(compareWithWeek(history, NOW)).toEqual({ today: 45, average: 36 });
		expect(belowWeekAverage(compareWithWeek(history, NOW))).toBe(false);
	});

	it('falls back to sum deltas without change', () => {
		const history = [...week(() => 1), ...rows(TODAY, 9, () => 1)].map((row, index) => ({
			start: row.start,
			end: row.end,
			sum: 100 + index
		}));
		const comparison = compareWithWeek(history, NOW);
		// the very first row has no previous sum and counts as 0
		expect(comparison?.today).toBe(9);
		expect(comparison?.average).toBeCloseTo((9 * 7 - 1) / 7);
	});

	it('has no answer before today has a finished hour', () => {
		expect(
			compareWithWeek(
				week(() => 1),
				NOW
			)
		).toBeNull();
	});

	it('has no answer without data on each of the last seven days', () => {
		const history = [
			...week(() => 1).filter((row) => row.start >= day(5)),
			...rows(TODAY, 9, () => 0.1)
		];
		expect(compareWithWeek(history, NOW)).toBeNull();
	});

	it('shows no badge for an empty week', () => {
		expect(belowWeekAverage({ today: 0, average: 0 })).toBe(false);
		expect(belowWeekAverage(null)).toBe(false);
	});
});
