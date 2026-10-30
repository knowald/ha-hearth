import { writable } from 'svelte/store';

/*
 * Settings one screen keeps for itself, over the values every screen shares
 * from hearth.yaml and configuration.yaml. Like the device name they belong
 * to the browser. An unset key follows the shared value.
 */

export interface ScreenOverrides {
	/** Periodically reposition static dashboard content on this screen. */
	pixel_shift?: boolean;
	keep_screen_on?: boolean;
	/** Minutes before the sleep screen, in quarters; 0 turns it off on this screen. */
	screensaver_minutes?: number;
	/** Interface scale in percent, 50 to 200. */
	scale?: number;
	mobile_scale?: number;
	locale?: string;
	reduce_motion?: boolean;
	haptics?: boolean;
	/** Silences alert chimes on this screen. */
	mute_chimes?: boolean;
	/** Keeps this screen black while the sensor reports nobody around. */
	presence_entity?: string;
	/** Seconds the screen takes to go black and to come back for the presence sensor. */
	presence_fade_seconds?: number;
	/** Minutes the sensor must read off before the screen changes. */
	presence_delay_minutes?: number;
	/** What the screen shows while nobody is around. */
	presence_view?: PresenceView;
}

export type PresenceView = 'black' | 'dim';

const STORAGE_KEY = 'hearthScreen';
const LOCALE = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i;
const ENTITY_ID = /^[a-z0-9_]+\.[a-z0-9_]+$/;

const flag = (value: unknown) => (typeof value === 'boolean' ? value : undefined);
const whole = (value: unknown, min: number, max: number) =>
	Number.isInteger(value) && (value as number) >= min && (value as number) <= max
		? (value as number)
		: undefined;
const quarters = (value: unknown, max: number) => {
	const count = whole(typeof value === 'number' ? value * 4 : undefined, 0, max * 4);
	return count === undefined ? undefined : count / 4;
};

/** Reads stored overrides, dropping whatever a hand edit or an older version left malformed. */
export function parseScreenOverrides(raw: string | null): ScreenOverrides {
	let stored: Record<string, unknown>;
	try {
		stored = JSON.parse(raw ?? '{}') ?? {};
	} catch {
		return {};
	}
	const overrides: ScreenOverrides = {
		pixel_shift: flag(stored.pixel_shift),
		keep_screen_on: flag(stored.keep_screen_on),
		screensaver_minutes: quarters(stored.screensaver_minutes, 1440),
		scale: whole(stored.scale, 50, 200),
		mobile_scale: whole(stored.mobile_scale, 50, 200),
		locale:
			typeof stored.locale === 'string' && LOCALE.test(stored.locale) ? stored.locale : undefined,
		reduce_motion: flag(stored.reduce_motion),
		haptics: flag(stored.haptics),
		mute_chimes: flag(stored.mute_chimes),
		presence_entity:
			typeof stored.presence_entity === 'string' && ENTITY_ID.test(stored.presence_entity)
				? stored.presence_entity
				: undefined,
		presence_fade_seconds: whole(stored.presence_fade_seconds, 0, 60),
		presence_delay_minutes: whole(stored.presence_delay_minutes, 0, 60),
		presence_view:
			stored.presence_view === 'black' || stored.presence_view === 'dim'
				? stored.presence_view
				: undefined
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
