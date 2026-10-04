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

// the last list fetched, so a page or schedule naming a saved theme wears it
// from the first frame instead of after the fetch
const CACHE_KEY = 'hearth-saved-themes';

function cachedThemes(): SavedTheme[] | undefined {
	try {
		const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null');
		return Array.isArray(cached) ? cached : undefined;
	} catch {
		return undefined;
	}
}

/** Saved themes: the cached list until a fetch brings the current one; see loadSavedThemes. */
export const savedThemes = writable<SavedTheme[] | undefined>(cachedThemes());

savedThemes.subscribe((themes) => {
	if (!themes) return;
	try {
		localStorage.setItem(CACHE_KEY, JSON.stringify(themes));
	} catch {
		// private mode or full storage: the next load fetches again
	}
});

let loading: Promise<void> | undefined;
let fetched = false;

const RETRY_MS = 3000;

async function fetchSavedThemes(): Promise<void> {
	const response = await fetch(`${base}/_api/hearth_themes`);
	if (!response.ok) throw new Error(`saved themes: ${response.status}`);
	savedThemes.set(await response.json());
	fetched = true;
}

/**
 * Fetches the saved themes, joining a fetch already under way. A failed
 * fetch is tried once more after a pause; after that the store keeps what it
 * had, the cached list included.
 */
export function loadSavedThemes(): Promise<void> {
	loading ??= fetchSavedThemes()
		.catch(() => new Promise((resolve) => setTimeout(resolve, RETRY_MS)).then(fetchSavedThemes))
		.catch((error) => console.warn('saved themes unavailable', error))
		.finally(() => (loading = undefined));
	return loading;
}

/** Fetches the saved themes once per visit, for the dashboard; editors refresh with loadSavedThemes. */
export function ensureSavedThemes(): void {
	if (!fetched && !loading) void loadSavedThemes();
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
	const index = scheduledIndex(schedule, day, holds);
	return index < 0 ? undefined : schedule![index];
}

/** The position of scheduledEntry's entry, -1 for none. */
export function scheduledIndex(
	schedule: ThemeScheduleEntry[] | undefined,
	day: string,
	holds: (conditions: VisibilityCondition[]) => boolean
): number {
	return (schedule ?? []).findIndex(
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

/**
 * The theme to wear, with `entryIndex` the schedule entry that holds (see
 * scheduledIndex). At night theme_night stays, unless that entry brings a
 * night of its own; a page theme is a day theme and steps aside for it the
 * same way. Without a theme_night, night wears the day's choice. A page
 * background goes over whichever theme that is, always with a scrim.
 */
export function activeLook(
	config: HearthConfig,
	{
		night,
		entryIndex,
		pageId,
		saved
	}: {
		night: boolean;
		entryIndex: number;
		pageId?: string;
		saved: SavedTheme[] | undefined;
	}
): HearthTheme | undefined {
	const entry = config.theme_schedule?.[entryIndex];
	const page = pageId === undefined ? undefined : config.rooms.find((room) => room.id === pageId);
	const dayTheme =
		resolveThemeChoice(page?.theme, saved) ??
		resolveThemeChoice(entry?.theme, saved) ??
		config.theme;
	const theme = night
		? (resolveThemeChoice(entry?.night, saved) ?? config.theme_night ?? dayTheme)
		: dayTheme;
	if (!page?.background_image) return theme;
	return {
		...theme,
		background_image: `url(${page.background_image})`,
		background_scrim: BACKGROUND_SCRIMS[page.background_scrim ?? 'medium']
	};
}
