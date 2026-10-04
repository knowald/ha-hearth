import { get } from 'svelte/store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseScreenOverrides } from './screen';

async function freshModule() {
	vi.resetModules();
	return import('./screen');
}

describe('parseScreenOverrides', () => {
	it('keeps valid values and drops the rest', () => {
		expect(
			parseScreenOverrides(
				JSON.stringify({
					keep_screen_on: false,
					screensaver_minutes: 0,
					scale: 120,
					mobile_scale: 30,
					locale: 'de-CH',
					reduce_motion: 'yes',
					haptics: true,
					unknown: 1
				})
			)
		).toEqual({
			keep_screen_on: false,
			screensaver_minutes: 0,
			scale: 120,
			locale: 'de-CH',
			haptics: true
		});
	});

	it('reads nothing from a missing or broken entry', () => {
		expect(parseScreenOverrides(null)).toEqual({});
		expect(parseScreenOverrides('{oops')).toEqual({});
		expect(parseScreenOverrides('null')).toEqual({});
		expect(parseScreenOverrides(JSON.stringify({ locale: '../etc' }))).toEqual({});
	});
});

describe('screenOverrides', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		localStorage.clear();
	});

	it('starts from what this browser stored', async () => {
		localStorage.setItem('hearthScreen', JSON.stringify({ screensaver_minutes: 0 }));
		const { screenOverrides } = await freshModule();
		expect(get(screenOverrides)).toEqual({ screensaver_minutes: 0 });
	});

	it('stores a value and forgets the entry once every key is cleared', async () => {
		const { screenOverrides, setScreenOverride } = await freshModule();
		setScreenOverride('keep_screen_on', false);
		setScreenOverride('scale', 130);
		expect(JSON.parse(localStorage.getItem('hearthScreen')!)).toEqual({
			keep_screen_on: false,
			scale: 130
		});
		setScreenOverride('keep_screen_on', undefined);
		expect(get(screenOverrides)).toEqual({ scale: 130 });
		setScreenOverride('scale', undefined);
		expect(localStorage.getItem('hearthScreen')).toBeNull();
		expect(get(screenOverrides)).toEqual({});
	});

	it('still applies a value while storage throws', async () => {
		const blocked = {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('blocked');
			},
			removeItem: () => {
				throw new Error('blocked');
			}
		};
		vi.stubGlobal('localStorage', blocked);
		const { screenOverrides, setScreenOverride } = await freshModule();
		expect(get(screenOverrides)).toEqual({});
		setScreenOverride('haptics', true);
		expect(get(screenOverrides)).toEqual({ haptics: true });
	});
});
