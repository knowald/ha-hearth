import { base } from '$app/paths';
import { writable } from 'svelte/store';
import {
	BACKGROUND_SCRIMS,
	THEME_PRESETS,
	usableThemeValue,
	type HearthTheme
} from '$lib/core/theme';
import type { HearthConfig, ThemeChoice, ThemeScheduleEntry, VisibilityCondition } from './config';

/*
 * Which theme the dashboard wears: the day or night theme, replaced by the
 * first theme_schedule entry that holds, replaced in turn by the look of the
 * page on screen.
 */

/** A theme saved on the server under data/hearth-themes. */
export interface SavedTheme {
	id: string;
	name: string;
	theme: HearthTheme;
}

/** Saved themes, once something asked for them; see loadSavedThemes. */
export const savedThemes = writable<SavedTheme[] | undefined>(undefined);

let loading: Promise<void> | undefined;

/** Fetches the saved themes, joining a fetch already under way; a failure leaves the store as it was. */
export function loadSavedThemes(): Promise<void> {
	loading ??= fetch(`${base}/_api/hearth_themes`)
		.then(async (response) => {
			if (!response.ok) throw new Error(`saved themes: ${response.status}`);
			savedThemes.set(await response.json());
		})
		.catch((error) => console.warn('saved themes unavailable', error))
		.finally(() => (loading = undefined));
	return loading;
}

const dayFormats = new Map<string, Intl.DateTimeFormat>();

/** The calendar day of `now` in `timeZone`, as MM-DD. */
export function monthDayOf(now: Date, timeZone?: string): string {
	let format = dayFormats.get(timeZone ?? '');
	if (!format) {
		format = new Intl.DateTimeFormat('en-US', {
			month: '2-digit',
			day: '2-digit',
			...(timeZone ? { timeZone } : {})
		});
		dayFormats.set(timeZone ?? '', format);
	}
	const parts = Object.fromEntries(
		format.formatToParts(now).map(({ type, value }) => [type, value])
	);
	return `${parts.month}-${parts.day}`;
}

/** Whether `day` is from `from` to `to`, both included; a later `from` runs across the new year. */
export function inDateRange(day: string, from: string, to: string): boolean {
	return from <= to ? day >= from && day <= to : day >= from || day <= to;
}

/** The first entry whose dates include `day` and whose conditions hold. */
export function scheduledEntry(
	schedule: ThemeScheduleEntry[] | undefined,
	day: string,
	holds: (conditions: VisibilityCondition[]) => boolean
): ThemeScheduleEntry | undefined {
	return schedule?.find(
		(entry) =>
			(!entry.from || !entry.to || inDateRange(day, entry.from, entry.to)) &&
			(!entry.when?.length || holds(entry.when))
	);
}

// a saved theme file is not checked when written; see applySavedTheme in ThemeEditSheet
function usableTheme(theme: HearthTheme): HearthTheme {
	return Object.fromEntries(
		Object.entries(theme).flatMap(([key, value]) => {
			const kept = typeof value === 'string' ? usableThemeValue(key, value) : null;
			return kept === null ? [] : [[key, kept]];
		})
	);
}

/**
 * The tokens a choice stands for: a preset by id, a saved theme by name or
 * id, or the tokens it carries. Undefined for a name nothing answers to,
 * which includes a saved theme before the saved themes have loaded.
 */
export function resolveThemeChoice(
	choice: ThemeChoice | undefined,
	saved: SavedTheme[] | undefined
): HearthTheme | undefined {
	if (choice === undefined || typeof choice !== 'string') return choice;
	const preset = THEME_PRESETS.find((entry) => entry.id === choice);
	if (preset) return preset.theme ?? {};
	const match = saved?.find((entry) => entry.name === choice || entry.id === choice);
	return match ? usableTheme(match.theme) : undefined;
}

/** Whether the config names a theme only the saved themes can answer. */
export function needsSavedThemes(config: Pick<HearthConfig, 'theme_schedule' | 'rooms'>): boolean {
	const named = (choice: ThemeChoice | undefined) =>
		typeof choice === 'string' && !THEME_PRESETS.some((preset) => preset.id === choice);
	return (
		(config.theme_schedule ?? []).some((entry) => named(entry.theme) || named(entry.night)) ||
		config.rooms.some((room) => named(room.theme))
	);
}

export interface ThemeLook {
	theme: HearthTheme | undefined;
	/** Changes when the theme switches source, which is when the dashboard fades. */
	key: string;
}

/**
 * The theme to wear. At night theme_night stays, unless the schedule entry
 * that holds brings a night of its own; a page theme is a day theme and
 * steps aside for it the same way. Without a theme_night, night wears the
 * day's choice. A page background goes over whichever theme that is, always
 * with a scrim.
 */
export function activeLook(
	config: HearthConfig,
	{
		night,
		day,
		pageId,
		holds,
		saved
	}: {
		night: boolean;
		day: string;
		pageId?: string;
		holds: (conditions: VisibilityCondition[]) => boolean;
		saved: SavedTheme[] | undefined;
	}
): ThemeLook {
	const entry = scheduledEntry(config.theme_schedule, day, holds);
	const entryIndex = entry ? config.theme_schedule!.indexOf(entry) : -1;
	const page = config.rooms.find((room) => room.id === pageId);
	const pageTheme = resolveThemeChoice(page?.theme, saved);
	const dayTheme = pageTheme ?? resolveThemeChoice(entry?.theme, saved) ?? config.theme;
	const entryNight = resolveThemeChoice(entry?.night, saved);
	const theme = night ? (entryNight ?? config.theme_night ?? dayTheme) : dayTheme;
	const source =
		night && (entryNight ?? config.theme_night)
			? `night:${entryNight ? entryIndex : ''}`
			: pageTheme
				? `page:${pageId}`
				: `day:${entryIndex}`;
	if (!page?.background_image) return { theme, key: source };
	return {
		theme: {
			...theme,
			background_image: `url(${page.background_image})`,
			background_scrim: BACKGROUND_SCRIMS[page.background_scrim ?? 'medium']
		},
		key: `${source}|image:${pageId}`
	};
}
