import { writable } from 'svelte/store';

/*
 * Settings one screen keeps for itself, over the values every screen shares
 * from hearth.yaml and configuration.yaml. Like the device name they belong
 * to the browser. An unset key follows the shared value.
 */

export interface ScreenOverrides {
	keep_screen_on?: boolean;
	/** Minutes before the sleep screen; 0 turns it off on this screen. */
	screensaver_minutes?: number;
	/** Interface scale in percent, 50 to 200. */
	scale?: number;
	mobile_scale?: number;
	locale?: string;
	reduce_motion?: boolean;
	haptics?: boolean;
	/** Silences alert chimes on this screen. */
	mute_chimes?: boolean;
}

const STORAGE_KEY = 'hearthScreen';
const LOCALE = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i;

const flag = (value: unknown) => (typeof value === 'boolean' ? value : undefined);
const whole = (value: unknown, min: number, max: number) =>
	Number.isInteger(value) && (value as number) >= min && (value as number) <= max
		? (value as number)
		: undefined;

/** Reads stored overrides, dropping whatever a hand edit or an older version left malformed. */
export function parseScreenOverrides(raw: string | null): ScreenOverrides {
	let stored: Record<string, unknown>;
	try {
		stored = JSON.parse(raw ?? '{}') ?? {};
	} catch {
		return {};
	}
	const overrides: ScreenOverrides = {
		keep_screen_on: flag(stored.keep_screen_on),
		screensaver_minutes: whole(stored.screensaver_minutes, 0, 1440),
		scale: whole(stored.scale, 50, 200),
		mobile_scale: whole(stored.mobile_scale, 50, 200),
		locale:
			typeof stored.locale === 'string' && LOCALE.test(stored.locale) ? stored.locale : undefined,
		reduce_motion: flag(stored.reduce_motion),
		haptics: flag(stored.haptics),
		mute_chimes: flag(stored.mute_chimes)
	};
	return Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== undefined));
}

function load(): ScreenOverrides {
	try {
		return parseScreenOverrides(localStorage.getItem(STORAGE_KEY));
	} catch {
		// no window during SSR, or storage blocked by the browser
		return {};
	}
}

export const screenOverrides = writable<ScreenOverrides>(load());

/** Sets one override, or clears it with undefined so the shared value applies again. */
export function setScreenOverride<K extends keyof ScreenOverrides>(
	key: K,
	value: ScreenOverrides[K] | undefined
) {
	screenOverrides.update((current) => {
		const next = { ...current, [key]: value };
		if (value === undefined) delete next[key];
		try {
			if (Object.keys(next).length) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
			else localStorage.removeItem(STORAGE_KEY);
		} catch {
			// storage blocked: the value still holds until the page reloads
		}
		return next;
	});
}
