import { derived, readable, writable } from 'svelte/store';
import { base } from '$app/paths';
import { configuration, type Configuration } from '$lib/core/app/configuration';
import { haptics } from '$lib/core/app/haptics';
import { motion } from '$lib/core/app/motion';
import { screenOverrides, type ScreenOverrides } from '$lib/core/app/screen';
import { selectedLanguage, translation } from '$lib/core/i18n';
import { MOTION } from '$lib/core/theme';
import { mediaQuery } from '$lib/ui/mediaQuery';
import { swallowNextClick } from '$lib/ui/gestures';
import type { HearthConfig } from './config';
import { hearthConfig } from './store';

/** What this screen runs with, once its own overrides are laid over the shared settings. */
export interface ScreenSettings {
	keepScreenOn: boolean;
	/** 0 when the sleep screen is off. */
	sleepMinutes: number;
	scale: number;
	/** Unset follows `scale`. */
	mobileScale?: number;
	locale: string;
	motion: boolean;
	haptics: boolean;
}

/**
 * The one place a shared setting meets this screen's override. Reduced
 * motion follows the OS unless configuration.yaml says otherwise, and an
 * override says otherwise again.
 */
export function resolveScreenSettings(
	hearth: Pick<HearthConfig, 'keep_screen_on' | 'screensaver_minutes' | 'scale' | 'mobile_scale'>,
	shared: Configuration | undefined,
	overrides: ScreenOverrides,
	osReducedMotion = false
): ScreenSettings {
	const sharedMotion = shared?.motion ?? !osReducedMotion;
	return {
		keepScreenOn: overrides.keep_screen_on ?? hearth.keep_screen_on ?? true,
		sleepMinutes: overrides.screensaver_minutes ?? hearth.screensaver_minutes ?? 0,
		scale: overrides.scale ?? hearth.scale ?? 100,
		// a scale picked for this screen is meant for it at any width
		mobileScale: overrides.mobile_scale ?? overrides.scale ?? hearth.mobile_scale,
		locale: overrides.locale ?? (shared?.locale || 'en'),
		motion: overrides.reduce_motion === undefined ? sharedMotion : !overrides.reduce_motion,
		haptics: overrides.haptics ?? shared?.haptics === true
	};
}

/**
 * The OS reduced-motion setting, kept live. The query is made on first
 * subscription rather than at import, which can run before a window exists.
 */
export const prefersReducedMotion = readable(false, (set) =>
	mediaQuery('(prefers-reduced-motion: reduce)').subscribe(set)
);

export const screenSettings = derived(
	[hearthConfig, configuration, screenOverrides, prefersReducedMotion],
	([$hearth, $shared, $overrides, $reduced]) =>
		resolveScreenSettings($hearth, $shared, $overrides, $reduced)
);

/**
 * Feeds the resolved language, motion and touch feedback into the app-wide
 * stores. The server rendered the shared language, so another one is
 * fetched. The language and <html lang> only switch once its copy is in, so
 * they always match the text on screen; a failed fetch leaves both alone
 * and the next change of settings, picking the language again included,
 * tries again. A reply that arrives after a newer choice is dropped.
 */
export function startScreenSettings(loadedLocale: string) {
	let shown = loadedLocale;
	let requested: string | undefined;
	return screenSettings.subscribe(async (settings) => {
		motion.set(settings.motion ? MOTION.base : 0);
		haptics.set(settings.haptics);
		const locale = settings.locale;
		if (locale === shown) {
			requested = undefined;
			return;
		}
		if (locale === requested) return;
		requested = locale;
		try {
			const response = await fetch(`${base}/_api/get_translation`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ locale })
			});
			if (!response.ok) throw new Error(`translation ${locale} failed with ${response.status}`);
			const loaded = await response.json();
			if (requested !== locale) return;
			translation.set(loaded);
			selectedLanguage.set(locale);
			document.documentElement.lang = locale;
			shown = locale;
		} catch (error) {
			console.error(error);
		} finally {
			if (requested === locale) requested = undefined;
		}
	});
}

export const screenSheetOpen = writable(false);

/** How long the locked edit toggle and the hidden corner want to be held. */
export const HOLD_MS = 2000;
const CORNER = 64;

/**
 * A press held still in the bottom-left corner opens This screen, for kiosk
 * frames started with ?menu=false where no button leads there; the dashboard
 * arms it only then, since the edit toggle sits in that corner otherwise. It
 * listens on the window instead of covering the corner, so taps there still
 * land, and the click that ends the hold is swallowed.
 */
export function startCornerHold(open: () => void) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	let startX = 0;
	let startY = 0;

	function cancel() {
		clearTimeout(timer);
		timer = undefined;
	}

	function handleDown(event: PointerEvent) {
		cancel();
		if (event.button !== 0) return;
		if (event.clientX > CORNER || event.clientY < innerHeight - CORNER) return;
		if ((event.target as Element | null)?.closest?.('.edit-entry')) return;
		startX = event.clientX;
		startY = event.clientY;
		timer = setTimeout(() => {
			timer = undefined;
			swallowNextClick();
			open();
		}, HOLD_MS);
	}

	function handleMove(event: PointerEvent) {
		if (timer && Math.hypot(event.clientX - startX, event.clientY - startY) > 12) cancel();
	}

	const listeners = [
		['pointerdown', handleDown],
		['pointermove', handleMove],
		['pointerup', cancel],
		['pointercancel', cancel]
	] as const;
	for (const [name, listener] of listeners) {
		window.addEventListener(name, listener as EventListener, { capture: true, passive: true });
	}
	return () => {
		cancel();
		for (const [name, listener] of listeners) {
			window.removeEventListener(name, listener as EventListener, { capture: true });
		}
	};
}
