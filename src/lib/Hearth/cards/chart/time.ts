import type { StatisticPeriod } from '$lib/core/ha/history';
import { clockTimeOptions, type ClockHourFormat } from '../../clock';
import type { ChartPeriod, ChartStyle } from './series';

/*
 * Wall-clock boundaries in the display zone: where days and hours start, for
 * the time axis and for asking the recorder for whole days. Every helper
 * takes the zone, undefined meaning the browser's, as store.ts asks.
 */

const HOUR = 3600 * 1000;
const clocks = new Map<string, Intl.DateTimeFormat>();

function wallClock(time: number, timeZone: string | undefined) {
	const key = timeZone ?? '';
	let clock = clocks.get(key);
	if (!clock) {
		clock = new Intl.DateTimeFormat('en-US', {
			hour: 'numeric',
			minute: 'numeric',
			second: 'numeric',
			hourCycle: 'h23',
			timeZone
		});
		clocks.set(key, clock);
	}
	const parts = clock.formatToParts(time);
	const part = (type: string) => Number(parts.find((entry) => entry.type === type)?.value ?? 0);
	return { hour: part('hour') % 24, minute: part('minute'), second: part('second') };
}

function milliseconds(time: number): number {
	return ((time % 1000) + 1000) % 1000;
}

/** The start of the wall-clock hour `time` falls in. */
export function hourStart(time: number, timeZone: string | undefined): number {
	const { minute, second } = wallClock(time, timeZone);
	return time - (minute * 60 + second) * 1000 - milliseconds(time);
}

/** The midnight that starts the wall-clock day `time` falls in. */
export function dayStart(time: number, timeZone: string | undefined): number {
	const { hour, minute, second } = wallClock(time, timeZone);
	const guess = time - ((hour * 60 + minute) * 60 + second) * 1000 - milliseconds(time);
	// a daylight saving change earlier that day leaves the guess an hour off
	const off = wallClock(guess, timeZone).hour;
	if (off === 0) return guess;
	return off >= 12 ? guess + (24 - off) * HOUR : guess - off * HOUR;
}

/** The midnight after the one `time`'s day starts at. */
export function nextDayStart(time: number, timeZone: string | undefined): number {
	return dayStart(dayStart(time, timeZone) + 36 * HOUR, timeZone);
}

/** The first midnight at or after `time`. */
export function dayStartAtOrAfter(time: number, timeZone: string | undefined): number {
	const start = dayStart(time, timeZone);
	return start === time ? start : nextDayStart(time, timeZone);
}

/**
 * Where the recorder is asked to start. Day bars start at a midnight, so
 * the first one is a whole day; everything else looks back the whole span.
 */
export function chartStart(
	end: number,
	span: number,
	bucket: StatisticPeriod,
	timeZone: string | undefined
): number {
	return bucket === 'day' ? dayStartAtOrAfter(end - span, timeZone) : end - span;
}

export interface AxisTick {
	/** The boundary the label names. */
	time: number;
	/** Where on the time axis the label sits. */
	at: number;
}

/**
 * The time axis labels: every six hours for a day, midnights for a week
 * (every other one when `crowded`), and a midnight a week for a month,
 * counted back from the newest so today is always named. Nothing after
 * `now`, so the axis never names tomorrow. A label for a day bar sits at
 * the bar's middle; any other at its own time.
 */
export function axisTicks(
	period: ChartPeriod,
	style: ChartStyle,
	domain: [number, number],
	now: number,
	timeZone: string | undefined,
	crowded = false
): AxisTick[] {
	const [start, end] = domain;
	const limit = Math.min(end, now);
	if (!(limit >= start)) return [];
	if (period === 'day') {
		const ticks: AxisTick[] = [];
		let hour = hourStart(start, timeZone);
		if (hour < start) hour += HOUR;
		for (let count = 0; hour <= limit && count < 50; count += 1, hour += HOUR) {
			if (wallClock(hour, timeZone).hour % 6 === 0) ticks.push({ time: hour, at: hour });
		}
		return ticks;
	}
	const days: AxisTick[] = [];
	let day = dayStartAtOrAfter(start, timeZone);
	for (let count = 0; day <= limit && count < 40; count += 1) {
		const next = nextDayStart(day, timeZone);
		const middle = style === 'bar' ? Math.min((day + next) / 2, end) : day;
		days.push({ time: day, at: middle });
		day = next;
	}
	const every = period === 'month' ? 7 : crowded ? 2 : 1;
	return days.filter((_, index) => (days.length - 1 - index) % every === 0);
}

export interface TimeFormats {
	axis: Intl.DateTimeFormatOptions;
	bucket: Intl.DateTimeFormatOptions;
}

/** How the axis and a selected bucket name their times, in the rail clock's zone and hour format. */
export function timeFormats(
	bucket: StatisticPeriod,
	period: ChartPeriod,
	timeZone: string | undefined,
	hourFormat: ClockHourFormat | undefined
): TimeFormats {
	const clock = clockTimeOptions(timeZone, hourFormat);
	const zone = { timeZone };
	return {
		axis:
			period === 'day'
				? clock
				: period === 'week'
					? { weekday: 'short', ...zone }
					: { day: 'numeric', month: 'short', ...zone },
		bucket:
			bucket === 'day'
				? { weekday: 'short', day: 'numeric', month: 'short', ...zone }
				: period === 'day'
					? clock
					: { weekday: 'short', ...clock }
	};
}

export function formatTime(
	time: number,
	locale: string | undefined,
	options: Intl.DateTimeFormatOptions
): string {
	try {
		return new Intl.DateTimeFormat(locale || undefined, options).format(time);
	} catch {
		// a language tag the browser does not know
		return new Intl.DateTimeFormat(undefined, options).format(time);
	}
}
