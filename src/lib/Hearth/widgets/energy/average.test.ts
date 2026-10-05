import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StatisticRow } from '$lib/core/ha/history';
import { belowWeekAverage, compareWithWeek, nextFetchIn, watchWeekAverage } from './average';

vi.mock('$lib/core/ha/history', () => ({ fetchStatistics: vi.fn() }));
import { fetchStatistics } from '$lib/core/ha/history';

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

describe('compareWithWeek, early in the day', () => {
	it('waits for three finished hours', () => {
		const early = new Date(2026, 9, 4, 2, 20);
		const history = [...week(() => 1), ...rows(TODAY, 2, () => 0.1)];
		expect(compareWithWeek(history, early)).toBeNull();
		const later = new Date(2026, 9, 4, 3, 20);
		expect(compareWithWeek([...history, ...rows(TODAY + 2 * HOUR, 1, () => 0.1)], later)).toEqual({
			today: expect.closeTo(0.3),
			average: 3
		});
	});
});

describe('nextFetchIn', () => {
	const MINUTE = 60_000;

	it('fetches at a quarter past the hour, once the hour is compiled', () => {
		expect(nextFetchIn(new Date(2026, 9, 4, 9, 0))).toBe(15 * MINUTE);
		expect(nextFetchIn(new Date(2026, 9, 4, 9, 15))).toBe(60 * MINUTE);
		expect(nextFetchIn(new Date(2026, 9, 4, 9, 20))).toBe(55 * MINUTE);
	});

	it('fetches right after midnight, which starts a new day', () => {
		expect(nextFetchIn(new Date(2026, 9, 4, 23, 30))).toBe(31 * MINUTE);
	});
});

describe('watchWeekAverage', () => {
	afterEach(() => vi.useRealTimers());

	it('applies the answer now and again at the next quarter past', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		vi.mocked(fetchStatistics).mockResolvedValue({
			'sensor.energy': [...week(() => 1), ...rows(TODAY, 9, () => 0.5)]
		});
		const apply = vi.fn();
		const stop = watchWeekAverage('sensor.energy', apply);
		await vi.advanceTimersByTimeAsync(0);
		expect(apply).toHaveBeenLastCalledWith(true);
		expect(fetchStatistics).toHaveBeenCalledTimes(1);
		// 9:20 to 10:15
		await vi.advanceTimersByTimeAsync(55 * 60_000);
		expect(fetchStatistics).toHaveBeenCalledTimes(2);
		stop();
		await vi.advanceTimersByTimeAsync(2 * 60 * 60_000);
		expect(fetchStatistics).toHaveBeenCalledTimes(2);
	});
});
