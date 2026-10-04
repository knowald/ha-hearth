import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configuration } from '$lib/core/app/configuration';
import { haptics } from '$lib/core/app/haptics';
import { motion } from '$lib/core/app/motion';
import { screenOverrides, setScreenOverride } from '$lib/core/app/screen';
import { selectedLanguage, translation } from '$lib/core/i18n';
import { MOTION } from '$lib/core/theme';
import { DEFAULT_HEARTH_CONFIG } from './config';
import { hearthConfig } from './store';
import {
	HOLD_MS,
	resolveScreenSettings,
	screenSettings,
	startCornerHold,
	startScreenSettings
} from './screen';

describe('resolveScreenSettings', () => {
	const shared = {
		keep_screen_on: undefined,
		screensaver_minutes: 5,
		scale: 110,
		mobile_scale: 80
	};

	it('follows the shared settings while nothing is overridden', () => {
		expect(resolveScreenSettings(shared, { locale: 'de', haptics: true }, {})).toEqual({
			keepScreenOn: true,
			sleepMinutes: 5,
			scale: 110,
			mobileScale: 80,
			locale: 'de',
			motion: true,
			haptics: true
		});
		expect(resolveScreenSettings({}, undefined, {})).toMatchObject({
			sleepMinutes: 0,
			scale: 100,
			mobileScale: undefined,
			locale: 'en',
			haptics: false
		});
	});

	it('lets an override win, including one that turns something off', () => {
		const settings = resolveScreenSettings(
			shared,
			{ locale: 'de', haptics: true },
			{ keep_screen_on: false, screensaver_minutes: 0, locale: 'pl', haptics: false }
		);
		expect(settings).toMatchObject({
			keepScreenOn: false,
			sleepMinutes: 0,
			locale: 'pl',
			haptics: false
		});
	});

	it('uses a screen scale on narrow widths too unless that has its own', () => {
		expect(resolveScreenSettings(shared, undefined, { scale: 130 }).mobileScale).toBe(130);
		expect(
			resolveScreenSettings(shared, undefined, { scale: 130, mobile_scale: 90 }).mobileScale
		).toBe(90);
	});

	it('reduces motion for the OS unless a setting says otherwise', () => {
		expect(resolveScreenSettings({}, {}, {}, true).motion).toBe(false);
		expect(resolveScreenSettings({}, { motion: true }, {}, true).motion).toBe(true);
		expect(resolveScreenSettings({}, { motion: false }, {}).motion).toBe(false);
		expect(resolveScreenSettings({}, { motion: false }, { reduce_motion: false }).motion).toBe(
			true
		);
		expect(resolveScreenSettings({}, {}, { reduce_motion: true }).motion).toBe(false);
	});
});

describe('screenSettings', () => {
	afterEach(() => {
		setScreenOverride('screensaver_minutes', undefined);
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
	});

	it('updates when the dashboard or this screen changes', () => {
		hearthConfig.set({ ...structuredClone(DEFAULT_HEARTH_CONFIG), screensaver_minutes: 10 });
		expect(get(screenSettings).sleepMinutes).toBe(10);
		setScreenOverride('screensaver_minutes', 0);
		expect(get(screenSettings).sleepMinutes).toBe(0);
		setScreenOverride('screensaver_minutes', undefined);
		expect(get(screenSettings).sleepMinutes).toBe(10);
	});
});

describe('startScreenSettings', () => {
	let stop: (() => void) | undefined;

	beforeEach(() => {
		configuration.set({ locale: 'en', haptics: true } as never);
	});

	afterEach(() => {
		stop?.();
		screenOverrides.set({});
		configuration.set(undefined as never);
		motion.set(MOTION.base);
		haptics.set(false);
		selectedLanguage.set('en');
		vi.unstubAllGlobals();
	});

	it('applies motion and touch feedback without fetching the loaded language', () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		screenOverrides.set({ reduce_motion: true });
		stop = startScreenSettings('en');
		expect(get(motion)).toBe(0);
		expect(get(haptics)).toBe(true);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('fetches the language this screen picked', async () => {
		const before = get(translation);
		const loaded = { ...before, hearth_close: 'Schliessen' };
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({ ok: true, json: async () => loaded }))
		);
		stop = startScreenSettings('en');
		screenOverrides.set({ locale: 'de' });
		expect(get(selectedLanguage)).toBe('de');
		expect(document.documentElement.lang).toBe('de');
		await vi.waitFor(() => expect(get(translation)).toBe(loaded));
		translation.set(before);
	});
});

describe('startCornerHold', () => {
	let stop: () => void;
	const open = vi.fn();

	function press(type: string, x: number, y: number) {
		window.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y }));
	}

	beforeEach(() => {
		vi.useFakeTimers();
		open.mockReset();
		stop = startCornerHold(open);
	});

	afterEach(() => {
		stop();
		vi.useRealTimers();
	});

	it('opens after a held press in the bottom-left corner', () => {
		press('pointerdown', 10, innerHeight - 10);
		vi.advanceTimersByTime(HOLD_MS - 1);
		expect(open).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(open).toHaveBeenCalledOnce();
	});

	it('ignores presses elsewhere, short ones and ones that move', () => {
		press('pointerdown', 300, innerHeight - 10);
		vi.advanceTimersByTime(HOLD_MS);
		press('pointerdown', 10, innerHeight - 10);
		press('pointerup', 10, innerHeight - 10);
		vi.advanceTimersByTime(HOLD_MS);
		press('pointerdown', 10, innerHeight - 10);
		press('pointermove', 40, innerHeight - 10);
		vi.advanceTimersByTime(HOLD_MS);
		expect(open).not.toHaveBeenCalled();
	});
});
