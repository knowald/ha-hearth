import type { StatisticPeriod, StatisticRow, StatisticType } from '$lib/core/ha/history';
import { chartY, type ChartBox, type ChartDomain } from '../../chartPath';
import type { ChartCard } from '../../model/cards/chart';

/*
 * The chart card's data, from recorder rows to what the plot draws: one list
 * of buckets shared by every series, each series' value per bucket, and the
 * domains and ticks of the axes. Pure, so the card's drawing is tested
 * without a connection.
 */

export type ChartStyle = NonNullable<ChartCard['style']>;
export type ChartPeriod = NonNullable<ChartCard['period']>;

/**
 * The statistics period one point or bar covers. A week of lines reads by
 * the hour; a week of bars, like a month, by the day.
 */
export function chartBucket(style: ChartStyle, period: ChartPeriod): StatisticPeriod {
	if (period === 'day') return 'hour';
	return period === 'week' && style === 'line' ? 'hour' : 'day';
}

export function chartTypes(style: ChartStyle): StatisticType[] {
	return style === 'line' ? ['mean', 'state'] : ['change', 'mean'];
}

/** A line follows the mean, or the state of a total; a bar shows what changed in its bucket. */
export function rowValue(row: StatisticRow, style: ChartStyle): number | null {
	const value = style === 'line' ? (row.mean ?? row.state) : (row.change ?? row.mean);
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export interface ChartBucket {
	start: number;
	end: number;
}

export interface ChartData {
	/** Every bucket any series has a row for, by start time. */
	buckets: ChartBucket[];
	/** Per series, in the order asked for: its value in each bucket, null where it has none. */
	values: (number | null)[][];
}

export function chartData(
	rows: Record<string, StatisticRow[] | undefined>,
	entityIds: string[],
	style: ChartStyle
): ChartData {
	const byStart = new Map<number, ChartBucket>();
	const series = entityIds.map((entityId) => {
		const values = new Map<number, number | null>();
		for (const row of rows[entityId] ?? []) {
			if (!Number.isFinite(row.start)) continue;
			const end = Number.isFinite(row.end) && row.end > row.start ? row.end : row.start;
			if (!byStart.has(row.start)) byStart.set(row.start, { start: row.start, end });
			values.set(row.start, rowValue(row, style));
		}
		return values;
	});
	const buckets = [...byStart.values()].sort((a, b) => a.start - b.start);
	return {
		buckets,
		values: series.map((values) => buckets.map((bucket) => values.get(bucket.start) ?? null))
	};
}

/** Whether any series has a value to draw. */
export function hasValues(data: ChartData): boolean {
	return data.values.some((series) => series.some((value) => value !== null));
}

/** Where on the time axis a bucket sits: a line point at its start, a bar at its middle. */
export function bucketTime(bucket: ChartBucket, style: ChartStyle): number {
	return style === 'line' ? bucket.start : (bucket.start + bucket.end) / 2;
}

/**
 * The points of one line, with a null wherever the line has to break: a
 * bucket without a value, or time between two buckets that no row covers.
 */
export function linePoints(data: ChartData, series: number): { x: number; y: number | null }[] {
	const points: { x: number; y: number | null }[] = [];
	data.buckets.forEach((bucket, index) => {
		const previous = data.buckets[index - 1];
		if (previous && bucket.start > previous.end) points.push({ x: previous.end, y: null });
		points.push({ x: bucket.start, y: data.values[series][index] });
	});
	return points;
}

const STEPS = [1, 2, 5, 10];

/** Even ticks around `low` to `high`, about `intervals` apart, and the domain they span. */
export function niceScale(
	low: number,
	high: number,
	intervals = 3
): { domain: [number, number]; ticks: number[]; step: number } {
	if (!Number.isFinite(low) || !Number.isFinite(high)) {
		return { domain: [0, 1], ticks: [0, 1], step: 1 };
	}
	if (low === high) {
		// a flat series gets room around it; a flat zero only above, where bars grow
		const room = Math.abs(low) / 10 || 1;
		[low, high] = low === 0 ? [0, 1] : [low - room, high + room];
	}
	const raw = (high - low) / intervals;
	const magnitude = 10 ** Math.floor(Math.log10(raw));
	const step = Number(
		((STEPS.find((factor) => factor * magnitude >= raw) ?? 10) * magnitude).toPrecision(12)
	);
	const first = Math.floor(low / step);
	const last = Math.ceil(high / step);
	const ticks: number[] = [];
	for (let index = first; index <= last; index += 1) {
		ticks.push(Number((index * step).toPrecision(12)));
	}
	return { domain: [ticks[0], ticks[ticks.length - 1]], ticks, step };
}

/**
 * Both axes. Time runs from `range` and widens to take in every bucket, a
 * bar's whole width included, so the current, unfinished bar fits. Bars keep
 * zero on the value axis, so a bar's length always means its value.
 */
export function chartScale(
	data: ChartData,
	style: ChartStyle,
	range: [number, number]
): { domain: ChartDomain; ticks: number[]; step: number } {
	const first = data.buckets[0];
	const last = data.buckets[data.buckets.length - 1];
	const x: [number, number] = [
		Math.min(range[0], first?.start ?? range[0]),
		Math.max(range[1], last ? (style === 'line' ? last.start : last.end) : range[1])
	];
	const numbers = data.values.flat().filter((value): value is number => value !== null);
	let low = numbers.length ? Math.min(...numbers) : 0;
	let high = numbers.length ? Math.max(...numbers) : 1;
	if (style === 'bar') [low, high] = [Math.min(0, low), Math.max(0, high)];
	const scale = niceScale(low, high);
	return { domain: { x, y: scale.domain }, ticks: scale.ticks, step: scale.step };
}

export interface BarRect {
	series: number;
	bucket: number;
	x: number;
	y: number;
	width: number;
	height: number;
	/** The bucket is still running, so its bar is not final yet. */
	current: boolean;
}

/** Where on the plot, in box units, a time falls. */
export function timeX(time: number, domain: ChartDomain, box: ChartBox): number {
	const [low, high] = domain.x;
	return ((time - low) / (high - low || 1)) * box.width;
}

// the share of a bucket's width its bars fill; the rest parts neighbours
const BAR_FILL = 0.7;

/**
 * Bars side by side within their bucket, one per series, grown from zero up
 * for a positive value and down for a negative one. A bucket with no value
 * for a series has no bar for it.
 */
export function barRects(
	data: ChartData,
	domain: ChartDomain,
	box: ChartBox,
	now: number
): BarRect[] {
	const count = data.values.length;
	const zero = chartY(0, box, domain.y);
	return data.buckets.flatMap((bucket, index) => {
		const left = timeX(Math.max(bucket.start, domain.x[0]), domain, box);
		const right = timeX(Math.min(bucket.end, domain.x[1]), domain, box);
		const slot = Math.max(0, right - left);
		const each = (slot * BAR_FILL) / count;
		return data.values.flatMap((values, series): BarRect[] => {
			const value = values[index];
			if (value === null) return [];
			const top = chartY(value, box, domain.y);
			// a value too small to show still leaves a hairline, so it reads as not missing
			const height = Math.max(Math.abs(zero - top), value === 0 ? 0 : 1);
			return [
				{
					series,
					bucket: index,
					x: left + (slot * (1 - BAR_FILL)) / 2 + series * each,
					y: value < 0 ? zero : Math.min(top, zero - height),
					width: Math.max(1, each - (count > 1 ? 1 : 0)),
					height,
					current: bucket.end > now
				}
			];
		});
	});
}

/** The bucket drawn closest to `time`, or -1 when there is none. */
export function nearestBucket(data: ChartData, style: ChartStyle, time: number): number {
	let nearest = -1;
	let distance = Infinity;
	data.buckets.forEach((bucket, index) => {
		const gap = Math.abs(bucketTime(bucket, style) - time);
		if (gap < distance) [nearest, distance] = [index, gap];
	});
	return nearest;
}

/** How the time axis and a selected bucket name their times. */
export function timeFormats(
	bucket: StatisticPeriod,
	period: ChartPeriod
): { axis: Intl.DateTimeFormatOptions; bucket: Intl.DateTimeFormatOptions } {
	const clock: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
	const day: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };
	return {
		axis:
			period === 'day'
				? clock
				: period === 'week'
					? { weekday: 'short', day: 'numeric' }
					: { day: 'numeric', month: 'short' },
		bucket: bucket === 'day' ? day : period === 'day' ? clock : { weekday: 'short', ...clock }
	};
}
