import { get } from 'svelte/store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BACKGROUND_SCRIMS, THEME_PRESETS } from '$lib/core/theme';
import { DEFAULT_HEARTH_CONFIG, type HearthConfig } from './config';
import {
	activeLook,
	inDateRange,
	monthDayOf,
	needsSavedThemes,
	resolveThemeChoice,
	scheduledEntry,
	scheduledIndex,
	type SavedTheme
} from './themeSchedule';

const preset = (id: string) => THEME_PRESETS.find((entry) => entry.id === id)!.theme!;

const SAVED: SavedTheme[] = [
	{ id: 'moss', name: 'Moss', theme: { accent: '#3a7d44', text_1: 'red; display: none' } }
];

function config(extra: Partial<HearthConfig>): HearthConfig {
	return { ...structuredClone(DEFAULT_HEARTH_CONFIG), ...extra };
}

const always = () => true;
const never = () => false;

describe('monthDayOf', () => {
	it('reads the calendar day on the clock of the time zone', () => {
		const instant = new Date('2026-12-31T23:30:00Z');
		expect(monthDayOf(instant, 'UTC')).toBe('12-31');
		expect(monthDayOf(instant, 'Europe/Berlin')).toBe('01-01');
		expect(monthDayOf(new Date('2026-03-01T03:00:00Z'), 'America/Los_Angeles')).toBe('02-28');
	});
});

describe('inDateRange', () => {
	it('includes both ends of a range inside the year', () => {
		expect(inDateRange('03-20', '03-20', '06-20')).toBe(true);
		expect(inDateRange('06-20', '03-20', '06-20')).toBe(true);
		expect(inDateRange('06-21', '03-20', '06-20')).toBe(false);
		expect(inDateRange('03-19', '03-20', '06-20')).toBe(false);
	});

	it('runs across the new year when from is later than to', () => {
		expect(inDateRange('12-24', '12-01', '02-28')).toBe(true);
		expect(inDateRange('01-15', '12-01', '02-28')).toBe(true);
		expect(inDateRange('02-28', '12-01', '02-28')).toBe(true);
		expect(inDateRange('03-01', '12-01', '02-28')).toBe(false);
		expect(inDateRange('11-30', '12-01', '02-28')).toBe(false);
	});

	it('treats one day as a range of one', () => {
		expect(inDateRange('12-24', '12-24', '12-24')).toBe(true);
		expect(inDateRange('12-25', '12-24', '12-24')).toBe(false);
	});
});

describe('scheduledEntry', () => {
	const schedule = [
		{ theme: 'holiday', from: '12-20', to: '12-26', when: [{ entity: 'input_boolean.holiday' }] },
		{ theme: 'winter', from: '12-01', to: '02-28' },
		{ theme: 'paper', when: [{ entity: 'input_boolean.guests', state: 'on' }] }
	];

	it('takes the first entry whose days and conditions hold', () => {
		expect(scheduledEntry(schedule, '12-24', always)?.theme).toBe('holiday');
		expect(scheduledEntry(schedule, '01-10', always)?.theme).toBe('winter');
		expect(scheduledEntry(schedule, '07-01', always)?.theme).toBe('paper');
	});

	it('passes over an entry whose conditions do not hold', () => {
		expect(scheduledEntry(schedule, '12-24', never)?.theme).toBe('winter');
		expect(scheduledEntry(schedule, '07-01', never)).toBeUndefined();
		expect(scheduledIndex(schedule, '07-01', never)).toBe(-1);
		expect(scheduledIndex(schedule, '01-10', always)).toBe(1);
	});

	it('hands each entry its own conditions', () => {
		const holds = (conditions: { entity?: string }[]) =>
			conditions.some((condition) => condition.entity === 'input_boolean.guests');
		expect(scheduledEntry(schedule, '12-24', holds as never)?.theme).toBe('winter');
	});
});

describe('resolveThemeChoice', () => {
	it('finds a preset by id, the default look as no tokens', () => {
		expect(resolveThemeChoice('winter', undefined)).toBe(preset('winter'));
		expect(resolveThemeChoice('hearth', undefined)).toEqual({});
	});

	it('finds a saved theme by name or id and drops values it cannot apply', () => {
		expect(resolveThemeChoice('Moss', SAVED)).toEqual({ accent: '#3a7d44' });
		expect(resolveThemeChoice('moss', SAVED)).toEqual({ accent: '#3a7d44' });
	});

	it('knows nothing of a name before the saved themes load, or one never saved', () => {
		expect(resolveThemeChoice('Moss', undefined)).toBeUndefined();
		expect(resolveThemeChoice('Lichen', SAVED)).toBeUndefined();
	});

	it('takes written-out tokens as they are', () => {
		expect(resolveThemeChoice({ accent: '#ff8800' }, undefined)).toEqual({ accent: '#ff8800' });
	});
});

describe('needsSavedThemes', () => {
	it('asks for saved themes only when a name is not a preset', () => {
		expect(needsSavedThemes(config({ theme_schedule: [{ theme: 'winter', when: [] }] }))).toBe(
			false
		);
		expect(needsSavedThemes(config({ theme_schedule: [{ theme: 'Moss', when: [] }] }))).toBe(true);
		const rooms = structuredClone(DEFAULT_HEARTH_CONFIG.rooms);
		rooms[0].theme = 'Moss';
		expect(needsSavedThemes(config({ rooms }))).toBe(true);
	});
});

describe('activeLook', () => {
	const day = { accent: '#111111' };
	const nightTheme = { accent: '#222222' };
	const winterOnly = [{ theme: 'winter', from: '12-01', to: '02-28' }];
	const look = (
		extra: Partial<HearthConfig>,
		{
			day: today = '12-24',
			...options
		}: Partial<Omit<Parameters<typeof activeLook>[1], 'entryIndex'>> & { day?: string } = {}
	) => {
		const settings = config({ theme: day, ...extra });
		return {
			theme: activeLook(settings, {
				night: false,
				entryIndex: scheduledIndex(settings.theme_schedule, today, always),
				saved: undefined,
				...options
			})
		};
	};

	it('wears the day theme when nothing is scheduled', () => {
		expect(look({}).theme).toBe(day);
	});

	it('replaces the day theme while an entry holds', () => {
		expect(look({ theme_schedule: winterOnly }).theme).toBe(preset('winter'));
		expect(look({ theme_schedule: winterOnly }, { day: '07-01' }).theme).toBe(day);
	});

	it('keeps the night theme unless the entry brings its own', () => {
		expect(
			look({ theme_schedule: winterOnly, theme_night: nightTheme }, { night: true }).theme
		).toBe(nightTheme);
		expect(
			look(
				{ theme_schedule: [{ ...winterOnly[0], night: 'void' }], theme_night: nightTheme },
				{ night: true }
			).theme
		).toBe(preset('void'));
	});

	it('wears the scheduled theme at night when there is no night theme', () => {
		expect(look({ theme_schedule: winterOnly }, { night: true }).theme).toBe(preset('winter'));
	});

	it('keeps the base theme while an entry names a saved theme not loaded yet', () => {
		const schedule = [{ theme: 'Moss', from: '12-01', to: '02-28' }];
		expect(look({ theme_schedule: schedule }).theme).toBe(day);
		expect(look({ theme_schedule: schedule }, { saved: SAVED }).theme).toEqual({
			accent: '#3a7d44'
		});
	});

	describe('page look', () => {
		const rooms = (page: Partial<HearthConfig['rooms'][number]>) => [
			{ id: 'home', name: 'Home', icon: 'home', cards: [[]] },
			{ id: 'garden', name: 'Garden', icon: 'park', cards: [[]], ...page }
		];

		it('wears the page theme over the schedule on that page only', () => {
			const extra = { theme_schedule: winterOnly, rooms: rooms({ theme: 'forest' }) };
			expect(look(extra, { pageId: 'garden' }).theme).toBe(preset('forest'));
			expect(look(extra, { pageId: 'home' }).theme).toBe(preset('winter'));
		});

		it('leaves the night theme to the night', () => {
			const extra = { theme_night: nightTheme, rooms: rooms({ theme: 'forest' }) };
			expect(look(extra, { pageId: 'garden', night: true }).theme).toBe(nightTheme);
		});

		it('lays the page background over the theme, always with a scrim', () => {
			const image = 'hearth-images/0123456789abcdef0123456789abcdef.webp';
			const extra = { rooms: rooms({ background_image: image }) };
			const garden = look(extra, { pageId: 'garden' }).theme;
			expect(garden).toEqual({
				...day,
				background_image: `url(${image})`,
				background_scrim: BACKGROUND_SCRIMS.medium
			});
			expect(
				look(
					{ rooms: rooms({ background_image: image, background_scrim: 'strong' }) },
					{
						pageId: 'garden'
					}
				).theme?.background_scrim
			).toBe(BACKGROUND_SCRIMS.strong);
			// leaving the page leaves the theme as it was
			expect(look(extra, { pageId: 'home' }).theme).toBe(day);
		});
	});
});

describe('saved themes', () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		localStorage.clear();
		vi.resetModules();
	});

	it('starts from the list the last visit fetched', async () => {
		localStorage.setItem('hearth-saved-themes', JSON.stringify(SAVED));
		vi.resetModules();
		const fresh = await import('./themeSchedule');
		expect(get(fresh.savedThemes)).toEqual(SAVED);
	});

	it('survives storage that cannot be read', async () => {
		localStorage.setItem('hearth-saved-themes', '{not json');
		vi.resetModules();
		const fresh = await import('./themeSchedule');
		expect(get(fresh.savedThemes)).toBeUndefined();
	});

	it('tries a failed fetch once more and caches what it gets', async () => {
		vi.useFakeTimers();
		const fetch = vi
			.fn()
			.mockRejectedValueOnce(new Error('offline'))
			.mockResolvedValue({ ok: true, json: async () => SAVED });
		vi.stubGlobal('fetch', fetch);
		vi.resetModules();
		const fresh = await import('./themeSchedule');
		const loaded = fresh.loadSavedThemes();
		await vi.advanceTimersByTimeAsync(3000);
		await loaded;
		expect(fetch).toHaveBeenCalledTimes(2);
		expect(get(fresh.savedThemes)).toEqual(SAVED);
		expect(JSON.parse(localStorage.getItem('hearth-saved-themes')!)).toEqual(SAVED);

		// the dashboard asks once per visit
		fresh.ensureSavedThemes();
		expect(fetch).toHaveBeenCalledTimes(2);
	});
});
