import { fetchStatistics, startDataRefresh, type StatisticRow } from '$lib/core/ha/history';
import { usagePerRow } from '../../model/widgets/energy';

/*
 * The energy widget's good-day badge, loaded on demand: today's use so far
 * against the average of the previous seven days over the same hours. A
 * whole-day average would make every morning look like a good day.
 */

const DAYS = 7;
const HOUR_MS = 60 * 60 * 1000;

export interface WeekComparison {
	today: number;
	average: number;
}

function dayStart(date: Date, daysBack = 0): number {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate() - daysBack).getTime();
}

/**
 * Compares hourly rows covering today and the seven days before it. Today
 * counts up to the end of its last row, since the recorder only writes
 * finished hours; each earlier day counts up to the same time of day. Null
 * until today has a row and all seven earlier days have data.
 */
export function compareWithWeek(rows: StatisticRow[], now: Date): WeekComparison | null {
	const usage = usagePerRow(rows);
	const todayStart = dayStart(now);
	const todayRows = rows.filter((row) => row.start >= todayStart);
	if (!todayRows.length) return null;
	const elapsed = Math.max(...todayRows.map((row) => row.end)) - todayStart;

	const used = (from: number, to: number) =>
		rows.reduce(
			(total, row, index) => (row.start >= from && row.start < to ? total + usage[index] : total),
			0
		);

	const days: number[] = [];
	for (let back = 1; back <= DAYS; back += 1) {
		const start = dayStart(now, back);
		if (!rows.some((row) => row.start >= start && row.start < start + elapsed)) return null;
		days.push(used(start, start + elapsed));
	}
	return {
		today: used(todayStart, todayStart + elapsed),
		average: days.reduce((sum, value) => sum + value, 0) / DAYS
	};
}

export function belowWeekAverage(comparison: WeekComparison | null): boolean {
	return !!comparison && comparison.average > 0 && comparison.today < comparison.average;
}

/** Fetches the comparison now and then hourly; returns the stop function. */
export function watchWeekAverage(statisticId: string, apply: (below: boolean) => void) {
	async function load() {
		const now = new Date();
		const rows =
			(await fetchStatistics([statisticId], new Date(dayStart(now, DAYS)), now, 'hour'))[
				statisticId
			] ?? [];
		return belowWeekAverage(compareWithWeek(rows, now));
	}
	return startDataRefresh(load, apply, HOUR_MS);
}
