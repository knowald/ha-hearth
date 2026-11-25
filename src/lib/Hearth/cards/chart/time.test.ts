import { describe, expect, it } from 'vitest';
import {
	axisTicks,
	chartStart,
	dayStart,
	dayStartAtOrAfter,
	hourStart,
	nextDayStart,
	timeFormats
} from './time';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

function wall(time: number, timeZone: string) {
	return new Intl.DateTimeFormat('en-GB', {
		timeZone,
		weekday: 'short',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	}).format(time);
}

describe('zone boundaries', () => {
	it('finds the hour and day start in a zone half an hour off UTC', () => {
		const time = Date.UTC(2026, 10, 17, 10, 47, 12, 300);
		expect(wall(hourStart(time, 'Asia/Kolkata'), 'Asia/Kolkata')).toMatch(/16:00$/);
		expect(wall(dayStart(time, 'Asia/Kolkata'), 'Asia/Kolkata')).toMatch(/00:00$/);
		expect(dayStart(time, 'UTC')).toBe(Date.UTC(2026, 10, 17));
	});

	it('steps over a daylight saving change to the next midnight', () => {
		// Berlin moves its clocks forward early on 29 March 2026
		const before = Date.UTC(2026, 2, 28, 12);
		const next = nextDayStart(before, 'Europe/Berlin');
		expect(wall(next, 'Europe/Berlin')).toBe('Sun 29, 00:00');
		const after = nextDayStart(next, 'Europe/Berlin');
		expect(wall(after, 'Europe/Berlin')).toBe('Mon 30, 00:00');
		expect(after - next).toBe(23 * HOUR);
		expect(dayStart(Date.UTC(2026, 2, 29, 20), 'Europe/Berlin')).toBe(next);
	});

	it('keeps a midnight as the first midnight at or after it', () => {
		const midnight = Date.UTC(2026, 10, 17);
		expect(dayStartAtOrAfter(midnight, 'UTC')).toBe(midnight);
		expect(dayStartAtOrAfter(midnight + 1, 'UTC')).toBe(midnight + DAY);
	});
});

describe('chartStart', () => {
	const now = Date.UTC(2026, 10, 17, 15, 20);

	it('starts day bars at the first whole day in the zone', () => {
		expect(chartStart(now, 7 * DAY, 'day', 'UTC')).toBe(Date.UTC(2026, 10, 11));
		expect(wall(chartStart(now, 30 * DAY, 'day', 'America/New_York'), 'America/New_York')).toMatch(
			/00:00$/
		);
	});

	it('looks back the whole span for hours', () => {
		expect(chartStart(now, DAY, 'hour', 'UTC')).toBe(now - DAY);
	});
});

describe('axisTicks', () => {
	const now = Date.UTC(2026, 10, 17, 15, 20);

	it('labels a day every six hours of the zone, nothing after now', () => {
		const ticks = axisTicks('day', 'line', [now - DAY, now], now, 'UTC');
		expect(ticks.map((tick) => new Date(tick.time).getUTCHours())).toEqual([18, 0, 6, 12]);
		expect(ticks.every((tick) => tick.time === tick.at)).toBe(true);
		const kolkata = axisTicks('day', 'line', [now - DAY, now], now, 'Asia/Kolkata');
		for (const tick of kolkata)
			expect(wall(tick.time, 'Asia/Kolkata')).toMatch(/(00|06|12|18):00$/);
	});

	it('keeps to full hours and midnights across a half-hour clock change', () => {
		// Lord Howe Island moves its clock on by 30 minutes on this day
		const zone = 'Australia/Lord_Howe';
		const end = Date.UTC(2026, 9, 4, 1);
		expect(wall(dayStart(end, zone), zone)).toMatch(/00:00$/);
		const ticks = axisTicks('day', 'line', [end - DAY, end], end, zone);
		expect(ticks.length).toBeGreaterThanOrEqual(3);
		for (const tick of ticks) expect(wall(tick.time, zone)).toMatch(/(00|06|12|18):00$/);
	});

	it('labels each day of a week of bars at the middle of its bar, up to today', () => {
		const start = chartStart(now, 7 * DAY, 'day', 'UTC');
		const end = Date.UTC(2026, 10, 18);
		const ticks = axisTicks('week', 'bar', [start, end], now, 'UTC');
		expect(ticks).toHaveLength(7);
		expect(ticks[0]).toEqual({ time: start, at: start + DAY / 2 });
		// today is the last one named, never tomorrow, though the axis runs to its midnight
		expect(ticks[6].time).toBe(Date.UTC(2026, 10, 17));
	});

	it('labels every other day of a crowded week, keeping today', () => {
		const start = now - 7 * DAY;
		const ticks = axisTicks('week', 'line', [start, now], now, 'UTC', true);
		expect(ticks.map((tick) => new Date(tick.time).getUTCDate())).toEqual([11, 13, 15, 17]);
	});

	it('labels a month about weekly, counted back from today', () => {
		const start = chartStart(now, 30 * DAY, 'day', 'UTC');
		const ticks = axisTicks('month', 'bar', [start, Date.UTC(2026, 10, 18)], now, 'UTC');
		expect(ticks.map((tick) => new Date(tick.time).getUTCDate())).toEqual([20, 27, 3, 10, 17]);
	});
});

describe('timeFormats', () => {
	it('follows the rail clock zone and hour format', () => {
		const formats = timeFormats('hour', 'day', 'Asia/Tokyo', '12');
		expect(formats.axis).toMatchObject({ hour12: true, timeZone: 'Asia/Tokyo' });
		expect(formats.bucket).toMatchObject({ hour12: true, timeZone: 'Asia/Tokyo' });
	});

	it('names days by weekday for a week and by date for a month, in the zone', () => {
		expect(timeFormats('day', 'week', 'UTC', undefined).axis).toEqual({
			weekday: 'short',
			timeZone: 'UTC'
		});
		expect(timeFormats('day', 'month', 'UTC', undefined).axis).toEqual({
			day: 'numeric',
			month: 'short',
			timeZone: 'UTC'
		});
		expect(timeFormats('day', 'week', 'UTC', '24').bucket).toMatchObject({ timeZone: 'UTC' });
		expect(timeFormats('hour', 'week', 'UTC', '24').bucket).toMatchObject({
			weekday: 'short',
			hour12: false,
			timeZone: 'UTC'
		});
	});
});
