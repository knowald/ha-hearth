import { get } from 'svelte/store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { deviceName } from '$lib/core/app/device';
import { DEFAULT_HEARTH_CONFIG, type HearthRoom } from './config';
import { hiddenPageIds, hiddenPages, navigablePages, shownPages } from './pages';
import { cancelEdit, enterEditMode, hearthConfig, hearthEditMode } from './store';
import { neighborRoom } from './swipeNav';

const room = (id: string, visibility?: HearthRoom['visibility']): HearthRoom => ({
	id,
	name: id,
	icon: 'home',
	visibility,
	cards: [[]]
});

const ROOMS = [
	room('home'),
	room('cameras', [{ entity: 'binary_sensor.doorbell', state: 'on' }]),
	room('kids', [{ time: { after: '07:00', before: '19:00' } }]),
	room('office', [{ device: 'office' }])
];

describe('hiddenPageIds', () => {
	it('lists the pages whose conditions do not hold', () => {
		const doorbell = { 'binary_sensor.doorbell': { state: 'off' } } as never;
		const evening = new Date('2026-10-02T20:00:00');
		expect(hiddenPageIds(ROOMS, doorbell, {}, { now: evening, device: 'hall' })).toEqual([
			'cameras',
			'kids',
			'office'
		]);
		const ringing = { 'binary_sensor.doorbell': { state: 'on' } } as never;
		const morning = new Date('2026-10-02T08:00:00');
		expect(hiddenPageIds(ROOMS, ringing, {}, { now: morning, device: 'office' })).toEqual([]);
	});
});

describe('shownPages', () => {
	it('leaves hidden pages out, except while editing', () => {
		expect(shownPages(ROOMS, ['cameras', 'kids'], false).map((entry) => entry.id)).toEqual([
			'home',
			'office'
		]);
		expect(shownPages(ROOMS, ['cameras', 'kids'], true)).toBe(ROOMS);
	});

	it('keeps the first page when every page is hidden', () => {
		const all = ROOMS.map((entry) => entry.id);
		expect(shownPages(ROOMS, all, false).map((entry) => entry.id)).toEqual(['home']);
	});

	it('lets a swipe skip over hidden pages', () => {
		const shown = shownPages(ROOMS, ['cameras', 'kids'], false);
		expect(neighborRoom(shown, 'home', 'next')).toBe('office');
		expect(neighborRoom(shown, 'office', 'previous')).toBe('home');
		expect(neighborRoom(shown, 'office', 'next')).toBeUndefined();
	});
});

describe('hiddenPages', () => {
	afterEach(() => {
		if (get(hearthEditMode)) cancelEdit();
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
		states.set(undefined as never);
		deviceName.set('');
		vi.useRealTimers();
	});

	it('hides nothing until the first states arrive, then follows them', () => {
		hearthConfig.set({ ...structuredClone(DEFAULT_HEARTH_CONFIG), rooms: ROOMS.slice(0, 2) });
		const seen: string[][] = [];
		const stop = hiddenPages.subscribe((ids) => seen.push(ids));
		expect(get(hiddenPages)).toEqual([]);
		states.set({ 'binary_sensor.doorbell': { state: 'off' } } as never);
		expect(get(hiddenPages)).toEqual(['cameras']);
		const updates = seen.length;
		// a state change that leaves the same pages hidden sets nothing new
		states.set({
			'binary_sensor.doorbell': { state: 'off' },
			'light.desk': { state: 'on' }
		} as never);
		expect(seen).toHaveLength(updates);
		states.set({ 'binary_sensor.doorbell': { state: 'on' } } as never);
		expect(get(hiddenPages)).toEqual([]);
		stop();
	});

	it('follows the minute clock and the device name', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-10-02T18:59:30'));
		hearthConfig.set({
			...structuredClone(DEFAULT_HEARTH_CONFIG),
			rooms: [ROOMS[0], ROOMS[2], ROOMS[3]]
		});
		states.set({});
		const stop = hiddenPages.subscribe(() => {});
		expect(get(hiddenPages)).toEqual(['office']);
		vi.advanceTimersByTime(31_000);
		expect(get(hiddenPages)).toEqual(['kids', 'office']);
		deviceName.set('office');
		expect(get(hiddenPages)).toEqual(['kids']);
		stop();
	});

	it('offers every page while editing', () => {
		hearthConfig.set({ ...structuredClone(DEFAULT_HEARTH_CONFIG), rooms: ROOMS.slice(0, 2) });
		states.set({ 'binary_sensor.doorbell': { state: 'off' } } as never);
		expect(get(navigablePages).map((entry) => entry.id)).toEqual(['home']);
		enterEditMode();
		expect(get(navigablePages).map((entry) => entry.id)).toEqual(['home', 'cameras']);
	});
});
