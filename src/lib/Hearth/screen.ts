import { derived, writable } from 'svelte/store';
import { base } from '$app/paths';
import { configuration, type Configuration } from '$lib/core/app/configuration';
import { haptics } from '$lib/core/app/haptics';
import { motion } from '$lib/core/app/motion';
import { screenOverrides, type ScreenOverrides } from '$lib/core/app/screen';
import { selectedLanguage, translation } from '$lib/core/i18n';
import { MOTION } from '$lib/core/theme';
import { mediaQuery } from '$lib/ui/mediaQuery';
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

/** The OS reduced-motion setting, kept live. */
export const prefersReducedMotion = mediaQuery('(prefers-reduced-motion: reduce)');

export const screenSettings = derived(
	[hearthConfig, configuration, screenOverrides, prefersReducedMotion],
	([$hearth, $shared, $overrides, $reduced]) =>
		resolveScreenSettings($hearth, $shared, $overrides, $reduced)
);

/**
 * Feeds the resolved language, motion and touch feedback into the app-wide
 * stores. The server rendered the shared language, so another one is
 * fetched; a reply that arrives after a newer choice is dropped.
 */
export function startScreenSettings(loadedLocale: string) {
	let wanted = loadedLocale;
	return screenSettings.subscribe(async (settings) => {
		motion.set(settings.motion ? MOTION.base : 0);
		haptics.set(settings.haptics);
		if (settings.locale === wanted) return;
		const requested = (wanted = settings.locale);
		selectedLanguage.set(requested);
		document.documentElement.lang = requested;
		try {
			const response = await fetch(`${base}/_api/get_translation`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ locale: requested })
			});
			const loaded = response.ok && (await response.json());
			if (loaded && requested === wanted) translation.set(loaded);
		} catch (error) {
			console.error(error);
		}
	});
}

export const screenSheetOpen = writable(false);

/** How long the locked edit toggle and the hidden corner want to be held. */
export const HOLD_MS = 2000;
const CORNER = 64;

/**
 * A press held still in the bottom-left corner opens This screen, for kiosk
 * frames started with ?menu=false where no button leads there. It listens on
 * the window instead of covering the corner, so taps there still land.
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
		if (event.clientX > CORNER || event.clientY < innerHeight - CORNER) return;
		startX = event.clientX;
		startY = event.clientY;
		timer = setTimeout(() => {
			timer = undefined;
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
