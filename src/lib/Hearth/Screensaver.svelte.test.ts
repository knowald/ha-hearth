import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { get } from 'svelte/store';
import type { HassConfig, HassEntities } from 'home-assistant-js-websocket';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { motion } from '$lib/core/app/motion';
import { MOTION } from '$lib/core/theme';
import { config as haConfig } from '$lib/core/ha/connection';
import { states } from '$lib/core/ha/entities';
import { DEFAULT_HEARTH_CONFIG, type HearthConfig } from './config';
import {
	activeAlerts,
	hearthConfig,
	hearthEditMode,
	presenceChangesAt,
	requestWake,
	sleepNow
} from './store';
import Screensaver from './Screensaver.svelte';
import Scene from './screensaver/Scene.svelte';
import { sequenceResume } from './screensaver/photos';

// the real map pulls in Leaflet and the network; this stands in with its props
const radarStub = vi.hoisted(() => ({ frames: true }));
vi.mock('./screensaver/RadarMap.svelte', () => ({
	default: (anchor: Comment, props: { view: unknown; onready?: (ready: boolean) => void }) => {
		const map = document.createElement('div');
		map.className = 'radar-map-stub';
		map.textContent = JSON.stringify(props.view);
		anchor.before(map);
		props.onready?.(radarStub.frames);
	}
}));

function configure(settings: Partial<HearthConfig>) {
	hearthConfig.set({ ...structuredClone(DEFAULT_HEARTH_CONFIG), ...settings });
}

async function showScreensaver() {
	const view = render(Screensaver, { minutes: 1 });
	vi.advanceTimersByTime(60_000);
	await tick();
	const overlay = view.container.querySelector('.screensaver') as HTMLElement;
	expect(overlay).not.toBeNull();
	return { ...view, overlay };
}

function cardUnderneath() {
	const card = document.createElement('button');
	const onclick = vi.fn();
	card.addEventListener('click', onclick);
	document.body.append(card);
	return { card, onclick };
}

describe('Screensaver', () => {
	// jsdom has no Web Animations; Svelte transitions call element.animate
	beforeAll(() => {
		Element.prototype.animate ??= () =>
			({ cancel() {}, finished: Promise.resolve() }) as unknown as Animation;
	});

	beforeEach(() => {
		vi.useFakeTimers();
		motion.set(0);
	});

	afterEach(() => {
		vi.useRealTimers();
		motion.set(190);
		document.body.innerHTML = '';
		sleepNow.set(false);
		hearthEditMode.set(false);
		radarStub.frames = true;
		configure({});
		haConfig.set(undefined as unknown as HassConfig);
		states.set({});
	});

	it('hides only the clock, retaining the date and wake behavior', async () => {
		configure({ screensaver_show_clock: false });
		const { container, overlay } = await showScreensaver();
		expect(container.querySelector('.clock')).toBeNull();
		expect(container.querySelector('.date')).not.toBeNull();
		await fireEvent.pointerDown(overlay);
		expect(container.querySelector('.screensaver')).toBeNull();
	});

	it('uses stacked localized digits, independent hour format and font at the chosen position', async () => {
		configure({
			screensaver_clock_layout: 'stacked',
			screensaver_clock_font: 'mono',
			screensaver_hour_format: '24',
			screensaver_show_seconds: true,
			screensaver_position_x: 0,
			screensaver_position_y: 100
		});
		const { container } = await showScreensaver();
		const clock = container.querySelector('.clock')!;
		expect(clock.classList.contains('stacked')).toBe(true);
		expect(clock.querySelectorAll('span')).toHaveLength(3);
		expect(container.querySelector('.screensaver-content')?.classList.contains('font-mono')).toBe(
			true
		);
		const position = container.querySelector('.content-position') as HTMLElement;
		expect(position.style.left).toBe('0%');
		expect(position.style.top).toBe('100%');
	});

	it('dims the background independently of the clock', async () => {
		configure({
			screensaver_background: 'image',
			screensaver_image: '/local/wall.jpg',
			screensaver_brightness: 75,
			screensaver_background_brightness: 25
		});
		const { container } = await showScreensaver();
		expect(
			(container.querySelector('.backdrop') as HTMLElement).style.getPropertyValue(
				'--screensaver-brightness'
			)
		).toBe('0.25');
		expect(container.querySelector('.scrim')).not.toBeNull();
	});

	it('loads no background at zero background brightness, and keeps the clock as set', async () => {
		haConfig.set({ latitude: 51.1, longitude: 17 } as HassConfig);
		configure({
			screensaver_background: 'radar',
			screensaver_brightness: 20,
			screensaver_background_brightness: 0
		});
		const { container } = await showScreensaver();
		vi.useRealTimers();
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(container.querySelector('.backdrop')).toBeNull();
		expect(container.querySelector('.radar-map-stub')).toBeNull();
		expect(container.querySelector('.scrim')).toBeNull();
		expect(
			(container.querySelector('.screensaver-content') as HTMLElement).style.getPropertyValue(
				'--screensaver-brightness'
			)
		).toBe('0.2');
	});

	it('stays away while an alert card is on screen', async () => {
		activeAlerts.set([{ key: 'event:a', title: 'A', severity: 'info', popup: true, since: 1 }]);
		const { container } = render(Screensaver, { minutes: 1 });
		vi.advanceTimersByTime(5 * 60_000);
		await tick();
		expect(container.querySelector('.screensaver')).toBeNull();
		activeAlerts.set([]);
		vi.advanceTimersByTime(60_000);
		await tick();
		expect(container.querySelector('.screensaver')).not.toBeNull();
	});

	it('stays away during an edit session and waits a full timeout after it', async () => {
		hearthEditMode.set(true);
		const { container } = render(Screensaver, { minutes: 1 });
		vi.advanceTimersByTime(5 * 60_000);
		await tick();
		expect(container.querySelector('.screensaver')).toBeNull();
		hearthEditMode.set(false);
		vi.advanceTimersByTime(59_000);
		await tick();
		expect(container.querySelector('.screensaver')).toBeNull();
		vi.advanceTimersByTime(1_000);
		await tick();
		expect(container.querySelector('.screensaver')).not.toBeNull();
	});

	it('still previews during an edit session', async () => {
		hearthEditMode.set(true);
		const { container } = render(Screensaver, { minutes: 1 });
		sleepNow.set('preview');
		await tick();
		expect(container.querySelector('.screensaver')).not.toBeNull();
	});

	it('steps aside when something asks to be seen', async () => {
		const { container } = await showScreensaver();
		requestWake();
		await tick();
		expect(container.querySelector('.screensaver')).toBeNull();
	});

	it('keeps the click of the wake tap from reaching the card underneath', async () => {
		const { container, overlay } = await showScreensaver();
		const { card, onclick } = cardUnderneath();

		await fireEvent.pointerDown(overlay);
		await tick();
		expect(container.querySelector('.screensaver')).toBeNull();

		await fireEvent.pointerUp(card);
		await fireEvent.click(card);
		expect(onclick).not.toHaveBeenCalled();
	});

	it('lets the next tap through once the wake click is spent', async () => {
		const { overlay } = await showScreensaver();
		const { card, onclick } = cardUnderneath();

		await fireEvent.pointerDown(overlay);
		await fireEvent.pointerUp(card);
		await fireEvent.click(card);
		await fireEvent.click(card);
		expect(onclick).toHaveBeenCalledTimes(1);
	});

	it('stops waiting for a click that never follows the release', async () => {
		const { overlay } = await showScreensaver();
		const { card, onclick } = cardUnderneath();

		await fireEvent.pointerDown(overlay);
		await fireEvent.pointerUp(card);
		vi.advanceTimersByTime(300);
		await fireEvent.click(card);
		expect(onclick).toHaveBeenCalledTimes(1);
	});

	it('wakes on a key press without swallowing a later click', async () => {
		const { container, overlay } = await showScreensaver();
		const { card, onclick } = cardUnderneath();

		await fireEvent.keyDown(overlay, { key: 'a' });
		await tick();
		expect(container.querySelector('.screensaver')).toBeNull();
		await fireEvent.click(card);
		expect(onclick).toHaveBeenCalledTimes(1);
	});

	it('takes focus while showing and hands it back on Escape', async () => {
		const { card } = cardUnderneath();
		card.focus();
		const { container, overlay } = await showScreensaver();
		expect(document.activeElement).toBe(overlay);

		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
		await tick();
		expect(container.querySelector('.screensaver')).toBeNull();
		expect(document.activeElement).toBe(card);
	});

	it('shows at once on preview, with no idle timeout, and ends the preview on wake', async () => {
		const { container } = render(Screensaver);
		expect(container.querySelector('.screensaver')).toBeNull();
		sleepNow.set('preview');
		await tick();
		const overlay = container.querySelector('.screensaver') as HTMLElement;
		expect(overlay).not.toBeNull();

		await fireEvent.keyDown(overlay, { key: 'a' });
		await tick();
		expect(container.querySelector('.screensaver')).toBeNull();
		expect(get(sleepNow)).toBe(false);
	});

	it('draws the radar map at the Home Assistant home behind a scrim', async () => {
		haConfig.set({ latitude: 51.1, longitude: 17 } as HassConfig);
		configure({ screensaver_background: 'radar', screensaver_radar: { zoom: 5 } });
		const { container } = await showScreensaver();
		vi.useRealTimers();
		await waitFor(() => expect(container.querySelector('.radar-map-stub')).not.toBeNull());
		expect(JSON.parse(container.querySelector('.radar-map-stub')!.textContent!)).toMatchObject({
			latitude: 51.1,
			longitude: 17,
			zoom: 5,
			basemap: 'dark'
		});
		await waitFor(() => expect(container.querySelector('.scrim')).not.toBeNull());
	});

	it('wakes from the radar sleep screen when an alert asks for the screen', async () => {
		haConfig.set({ latitude: 51.1, longitude: 17 } as HassConfig);
		configure({ screensaver_background: 'radar' });
		sleepNow.set('preview');
		const { container } = render(Screensaver);
		await tick();
		expect(container.querySelector('.screensaver')).not.toBeNull();

		requestWake();
		await tick();
		expect(container.querySelector('.screensaver')).toBeNull();
		expect(get(sleepNow)).toBe(false);
	});

	it('keeps the plain background and dim text while the radar has no frames', async () => {
		radarStub.frames = false;
		haConfig.set({ latitude: 51.1, longitude: 17 } as HassConfig);
		configure({ screensaver_background: 'radar' });
		const { container } = await showScreensaver();
		vi.useRealTimers();
		await waitFor(() => expect(container.querySelector('.radar-map-stub')).not.toBeNull());
		expect(container.querySelector('.scrim')).toBeNull();
		const content = container.querySelector('.screensaver-content') as HTMLElement;
		expect(content.style.getPropertyValue('--screensaver-brightness')).toBe('0.32');
	});

	it('uses an explicit radar location over the home', async () => {
		haConfig.set({ latitude: 51.1, longitude: 17 } as HassConfig);
		configure({
			screensaver_background: 'radar',
			screensaver_radar: { latitude: 40.4, longitude: -3.7, basemap: 'light' }
		});
		const { container } = await showScreensaver();
		vi.useRealTimers();
		await waitFor(() => expect(container.querySelector('.radar-map-stub')).not.toBeNull());
		expect(JSON.parse(container.querySelector('.radar-map-stub')!.textContent!)).toMatchObject({
			latitude: 40.4,
			longitude: -3.7,
			basemap: 'light'
		});
	});

	it('stays plain black when the radar has no location to show', async () => {
		configure({ screensaver_background: 'radar' });
		const { container } = await showScreensaver();
		await tick();
		expect(container.querySelector('.radar-map-stub')).toBeNull();
		expect(container.querySelector('.scrim')).toBeNull();
	});

	it('shows the image background and falls back to black when it fails to load', async () => {
		configure({ screensaver_background: 'image', screensaver_image: 'https://example.com/a.jpg' });
		const { container } = await showScreensaver();
		const photo = container.querySelector('img.photo') as HTMLImageElement;
		expect(photo.src).toBe('https://example.com/a.jpg');
		expect(container.querySelector('.scrim')).not.toBeNull();

		await fireEvent.error(photo);
		expect(container.querySelector('img.photo')).toBeNull();
		expect(container.querySelector('.scrim')).toBeNull();
	});

	it('tries a failed image again on the next sleep', async () => {
		configure({ screensaver_background: 'image', screensaver_image: 'https://example.com/a.jpg' });
		const { container, overlay } = await showScreensaver();
		await fireEvent.error(container.querySelector('img.photo')!);
		await fireEvent.keyDown(overlay, { key: 'a' });
		await tick();
		expect(container.querySelector('.screensaver')).toBeNull();

		vi.advanceTimersByTime(60_000);
		await tick();
		expect(container.querySelector('img.photo')).not.toBeNull();
	});

	it('ignores the image while the background is not set to image', async () => {
		configure({ screensaver_image: 'https://example.com/a.jpg' });
		const { container } = await showScreensaver();
		expect(container.querySelector('img.photo')).toBeNull();
	});

	it('hides the date, sizes the clock and shows the weather when configured', async () => {
		states.set({
			'weather.home': {
				entity_id: 'weather.home',
				state: 'partlycloudy',
				attributes: { temperature: 17.6 }
			}
		} as unknown as HassEntities);
		configure({
			screensaver_show_date: false,
			screensaver_clock_size: 'large',
			screensaver_weather_entity: 'weather.home'
		});
		const { container } = await showScreensaver();
		expect(container.querySelector('.date')).toBeNull();
		expect(container.querySelector('.screensaver-content.clock-large')).not.toBeNull();
		expect(container.querySelector('.weather')?.textContent).toContain('18°');
	});
	it('sleeps after 15 seconds', async () => {
		const { container } = render(Screensaver, { minutes: 0.25 });
		vi.advanceTimersByTime(14_999);
		await tick();
		expect(container.querySelector('.screensaver')).toBeNull();
		vi.advanceTimersByTime(1);
		await tick();
		expect(container.querySelector('.screensaver')).not.toBeNull();
	});

	describe('presence sensor', () => {
		const SENSOR = 'binary_sensor.hallway';

		function sense(state: string, changedAgoMs = 0) {
			const last_changed = new Date(Date.now() - changedAgoMs).toISOString();
			states.set({
				[SENSOR]: { entity_id: SENSOR, state, attributes: {}, last_changed }
			} as unknown as HassEntities);
		}

		const overlay = (container: HTMLElement) => container.querySelector('.screensaver');
		const sleepTimer = () => document.documentElement.dataset.sleepTimer;

		it('goes black at once while nobody is around and back to the sleep screen on arrival', async () => {
			sense('on');
			const { container } = render(Screensaver, { minutes: 5, presence: SENSOR });
			await tick();
			expect(overlay(container)).toBeNull();
			sense('off');
			await tick();
			expect(overlay(container)).not.toBeNull();
			expect(container.querySelector('.clock')).toBeNull();
			expect(sleepTimer()).toBe('blank');
			sense('on');
			await tick();
			expect(container.querySelector('.clock')).not.toBeNull();
			expect(sleepTimer()).toBe('asleep');
			await fireEvent.pointerDown(overlay(container)!);
			expect(overlay(container)).toBeNull();
		});

		it('shows the dashboard on arrival when the sleep screen is off', async () => {
			sense('off');
			const { container } = render(Screensaver, { presence: SENSOR });
			await tick();
			expect(sleepTimer()).toBe('blank');
			sense('on');
			await tick();
			expect(overlay(container)).toBeNull();
			expect(sleepTimer()).toBe('off');
		});

		it('blacks out a sleep screen that is already showing', async () => {
			sense('on');
			const { container } = render(Screensaver, { minutes: 1, presence: SENSOR });
			vi.advanceTimersByTime(60_000);
			await tick();
			expect(container.querySelector('.clock')).not.toBeNull();
			sense('off');
			await tick();
			expect(container.querySelector('.clock')).toBeNull();
			expect(sleepTimer()).toBe('blank');
		});

		it('goes black again a minute after a tap while the sensor still reads off', async () => {
			sense('off');
			const { container } = render(Screensaver, { presence: SENSOR });
			await tick();
			await fireEvent.pointerDown(overlay(container)!);
			expect(overlay(container)).toBeNull();
			expect(sleepTimer()).toBe('armed');
			vi.advanceTimersByTime(59_000);
			await tick();
			expect(overlay(container)).toBeNull();
			vi.advanceTimersByTime(1_000);
			await tick();
			expect(sleepTimer()).toBe('blank');
		});

		it('waits for an alert card and an edit session', async () => {
			activeAlerts.set([{ key: 'event:a', title: 'A', severity: 'info', popup: true, since: 1 }]);
			sense('on');
			const { container } = render(Screensaver, { presence: SENSOR });
			sense('off');
			await tick();
			expect(overlay(container)).toBeNull();
			expect(sleepTimer()).toBe('held');
			activeAlerts.set([]);
			await tick();
			vi.advanceTimersByTime(60_000);
			await tick();
			expect(sleepTimer()).toBe('blank');

			hearthEditMode.set(true);
			await fireEvent.pointerDown(overlay(container)!);
			sense('on');
			await tick();
			sense('off');
			await tick();
			expect(overlay(container)).toBeNull();
		});

		it('leaves the screen as it is while the sensor is unavailable', async () => {
			sense('unavailable');
			const { container } = render(Screensaver, { presence: SENSOR });
			await tick();
			vi.advanceTimersByTime(10 * 60_000);
			await tick();
			expect(overlay(container)).toBeNull();
			expect(sleepTimer()).toBe('off');
		});

		it('fades a showing sleep screen to black and back over the fade', async () => {
			motion.set(MOTION.base);
			sense('on');
			const { container } = render(Screensaver, { minutes: 1, presence: SENSOR, fadeMs: 3000 });
			vi.advanceTimersByTime(60_000);
			await tick();
			sense('off');
			await tick();
			expect(sleepTimer()).toBe('blank');
			expect(container.querySelector('.blackout')).not.toBeNull();
			// the sleep screen stays under the blackout until it has faded in
			expect(container.querySelector('.clock')).not.toBeNull();
			vi.advanceTimersByTime(2_999);
			await tick();
			expect(container.querySelector('.clock')).not.toBeNull();
			vi.advanceTimersByTime(1);
			await tick();
			expect(container.querySelector('.clock')).toBeNull();
			sense('on');
			await tick();
			expect(container.querySelector('.clock')).not.toBeNull();
			expect(sleepTimer()).toBe('asleep');
		});

		it('keeps the sleep screen when someone arrives during the fade', async () => {
			motion.set(MOTION.base);
			sense('on');
			const { container } = render(Screensaver, { minutes: 1, presence: SENSOR, fadeMs: 3000 });
			vi.advanceTimersByTime(60_000);
			await tick();
			sense('off');
			await tick();
			vi.advanceTimersByTime(1_000);
			sense('on');
			await tick();
			vi.advanceTimersByTime(5_000);
			await tick();
			expect(container.querySelector('.clock')).not.toBeNull();
			expect(sleepTimer()).toBe('asleep');
		});

		it('never shows the sleep screen when an awake dashboard fades to black', async () => {
			motion.set(MOTION.base);
			sense('on');
			const { container } = render(Screensaver, { minutes: 5, presence: SENSOR, fadeMs: 3000 });
			await tick();
			sense('off');
			await tick();
			expect(overlay(container)).not.toBeNull();
			expect(container.querySelector('.clock')).toBeNull();
		});

		it('waits for the sensor to read off for the delay', async () => {
			sense('on');
			const { container } = render(Screensaver, { presence: SENSOR, delayMs: 120_000 });
			sense('off');
			await tick();
			vi.advanceTimersByTime(119_999);
			await tick();
			expect(overlay(container)).toBeNull();
			vi.advanceTimersByTime(1);
			await tick();
			expect(sleepTimer()).toBe('blank');
		});

		it('starts no blackout when someone moves again within the delay', async () => {
			sense('on');
			const { container } = render(Screensaver, { presence: SENSOR, delayMs: 120_000 });
			sense('off');
			await tick();
			vi.advanceTimersByTime(60_000);
			sense('on');
			await tick();
			vi.advanceTimersByTime(120_000);
			await tick();
			expect(overlay(container)).toBeNull();
		});

		it('counts the delay from when the sensor last changed', async () => {
			sense('off', 5 * 60_000);
			render(Screensaver, { presence: SENSOR, delayMs: 120_000 });
			await tick();
			expect(sleepTimer()).toBe('blank');
		});

		it('dims the sleep screen instead of going black', async () => {
			sense('on');
			const { container } = render(Screensaver, { minutes: 5, presence: SENSOR, dim: true });
			sense('off');
			await tick();
			expect(sleepTimer()).toBe('dimmed');
			expect(container.querySelector('.clock')).not.toBeNull();
			expect(container.querySelector('.blackout.dim')).not.toBeNull();
			sense('on');
			await tick();
			expect(sleepTimer()).toBe('asleep');
			expect(container.querySelector('.blackout')).toBeNull();
		});

		it('stays black when the sensor drops out or restarts while nobody is around', async () => {
			sense('off');
			const { container } = render(Screensaver, { minutes: 5, presence: SENSOR });
			await tick();
			expect(sleepTimer()).toBe('blank');
			sense('unavailable');
			await tick();
			expect(sleepTimer()).toBe('blank');
			expect(container.querySelector('.clock')).toBeNull();
			// a restart brings the sensor back off with a fresh last_changed
			sense('off');
			await tick();
			expect(sleepTimer()).toBe('blank');
		});

		it('stays black when the delay grows while nobody is around', async () => {
			sense('off', 60_000);
			const view = render(Screensaver, { presence: SENSOR, delayMs: 0 });
			await tick();
			expect(sleepTimer()).toBe('blank');
			await view.rerender({ presence: SENSOR, delayMs: 5 * 60_000 });
			await tick();
			expect(sleepTimer()).toBe('blank');
		});

		it('publishes when the wait ends for the status line', async () => {
			sense('on');
			render(Screensaver, { presence: SENSOR, delayMs: 120_000 });
			sense('off');
			await tick();
			expect(get(presenceChangesAt)).toBe(Date.now() + 120_000);
			sense('on');
			await tick();
			expect(get(presenceChangesAt)).toBeUndefined();
		});

		it('blacks out a sleep screen that started soon after a touch', async () => {
			sense('on');
			render(Screensaver, { minutes: 0.25, presence: SENSOR, delayMs: 30_000 });
			await tick();
			window.dispatchEvent(new Event('pointerdown'));
			vi.advanceTimersByTime(15_000);
			await tick();
			expect(sleepTimer()).toBe('asleep');
			sense('off');
			vi.advanceTimersByTime(30_000);
			await tick();
			expect(sleepTimer()).toBe('blank');
		});

		it('with a delay, waits a minute after the last touch before going black', async () => {
			sense('on');
			const { container } = render(Screensaver, { presence: SENSOR, delayMs: 30_000 });
			await tick();
			sense('off');
			await tick();
			vi.advanceTimersByTime(20_000);
			window.dispatchEvent(new Event('pointerdown'));
			vi.advanceTimersByTime(10_000);
			await tick();
			expect(overlay(container)).toBeNull();
			expect(sleepTimer()).toBe('armed');
			vi.advanceTimersByTime(50_000);
			await tick();
			expect(sleepTimer()).toBe('blank');
		});

		it('keeps a sleep action black while nobody is around, and shows the sleep screen on arrival', async () => {
			sense('off');
			const { container } = render(Screensaver, { presence: SENSOR, dim: false });
			await tick();
			sleepNow.set('action');
			await tick();
			expect(sleepTimer()).toBe('blank');
			expect(container.querySelector('.clock')).toBeNull();
			sense('on');
			await tick();
			expect(sleepTimer()).toBe('asleep');
			expect(container.querySelector('.clock')).not.toBeNull();
		});

		it('shows the sleep screen for a sleep action while someone is around', async () => {
			sense('on');
			const { container } = render(Screensaver, { presence: SENSOR });
			await tick();
			sleepNow.set('action');
			await tick();
			expect(sleepTimer()).toBe('asleep');
			expect(container.querySelector('.clock')).not.toBeNull();
		});

		it('still previews the sleep screen while nobody is around', async () => {
			sense('off');
			const { container } = render(Screensaver, { minutes: 5, presence: SENSOR });
			await tick();
			sleepNow.set('preview');
			await tick();
			expect(container.querySelector('.clock')).not.toBeNull();
		});
	});

	describe('photo frame', () => {
		const FIRST = `hearth-images/${'a'.repeat(32)}.webp`;
		const SECOND = `hearth-images/${'b'.repeat(32)}.jpg`;
		const slides = (container: HTMLElement) =>
			[...container.querySelectorAll<HTMLImageElement>('img.slide')].map((slide) =>
				slide.src.split('/').pop()
			);

		afterEach(() => {
			Object.defineProperty(document, 'hidden', { configurable: true, value: false });
			sequenceResume.clear();
		});

		it('steps through the uploaded photos in order behind a scrim', async () => {
			configure({
				screensaver_background: 'photos',
				screensaver_photos: [FIRST, SECOND],
				screensaver_photo_order: 'sequence',
				screensaver_photo_seconds: 10
			});
			const { container } = await showScreensaver();
			expect(slides(container)).toEqual([`${'a'.repeat(32)}.webp`]);
			// the scrim waits for a photo to load
			expect(container.querySelector('.scrim')).toBeNull();
			await fireEvent.load(container.querySelector('img.slide')!);
			expect(container.querySelector('.scrim')).not.toBeNull();

			vi.advanceTimersByTime(10_000);
			await tick();
			expect(slides(container)).toEqual([`${'b'.repeat(32)}.jpg`]);
			vi.advanceTimersByTime(10_000);
			await tick();
			expect(slides(container)).toEqual([`${'a'.repeat(32)}.webp`]);
		});

		it('carries a sequence on across sleeps', async () => {
			configure({
				screensaver_background: 'photos',
				screensaver_photos: [FIRST, SECOND],
				screensaver_photo_order: 'sequence'
			});
			const { container, overlay } = await showScreensaver();
			expect(slides(container)).toEqual([`${'a'.repeat(32)}.webp`]);
			await fireEvent.keyDown(overlay, { key: 'a' });
			vi.advanceTimersByTime(60_000);
			await tick();
			expect(slides(container)).toEqual([`${'b'.repeat(32)}.jpg`]);
		});

		it('leaves the sequence where it was when only the settings preview plays it', async () => {
			configure({
				screensaver_background: 'photos',
				screensaver_photos: [FIRST, SECOND],
				screensaver_photo_order: 'sequence',
				screensaver_photo_seconds: 10
			});
			const { container } = render(Scene, { preview: true });
			await tick();
			expect(slides(container)).toEqual([`${'a'.repeat(32)}.webp`]);
			vi.advanceTimersByTime(10_000);
			await tick();
			expect(slides(container)).toEqual([`${'b'.repeat(32)}.jpg`]);
			expect(sequenceResume.size).toBe(0);
		});

		it('leaves the sequence where it was when the full screen preview plays it', async () => {
			configure({
				screensaver_background: 'photos',
				screensaver_photos: [FIRST, SECOND],
				screensaver_photo_order: 'sequence',
				screensaver_photo_seconds: 10
			});
			const { container } = render(Screensaver);
			sleepNow.set('preview');
			await tick();
			vi.advanceTimersByTime(10_000);
			await tick();
			expect(slides(container)).toEqual([`${'b'.repeat(32)}.jpg`]);
			expect(sequenceResume.size).toBe(0);
		});

		it('carries the sequence on when a sleep action shows the sleep screen', async () => {
			configure({
				screensaver_background: 'photos',
				screensaver_photos: [FIRST, SECOND],
				screensaver_photo_order: 'sequence',
				screensaver_photo_seconds: 10
			});
			render(Screensaver);
			sleepNow.set('action');
			await tick();
			vi.advanceTimersByTime(10_000);
			await tick();
			expect(sequenceResume.size).toBe(1);
		});

		it('fades the next photo in over the last one, which stays until the fade ends', async () => {
			motion.set(190);
			configure({
				screensaver_background: 'photos',
				screensaver_photos: [FIRST, SECOND],
				screensaver_photo_order: 'sequence',
				screensaver_photo_seconds: 10
			});
			const { container } = await showScreensaver();
			vi.advanceTimersByTime(10_000);
			await tick();
			expect(slides(container)).toEqual([`${'a'.repeat(32)}.webp`, `${'b'.repeat(32)}.jpg`]);
			const top = container.querySelectorAll('img.slide')[1];
			top.dispatchEvent(new CustomEvent('introend'));
			await tick();
			expect(slides(container)).toEqual([`${'b'.repeat(32)}.jpg`]);
		});

		it('pans only with motion on', async () => {
			configure({ screensaver_background: 'photos', screensaver_photos: [FIRST] });
			const { container } = await showScreensaver();
			expect(container.querySelector('img.slide')?.classList.contains('pan')).toBe(false);
			motion.set(190);
			await tick();
			expect(container.querySelector('img.slide')?.classList.contains('pan')).toBe(true);
		});

		it('skips a photo that fails and falls back to black once all have', async () => {
			configure({
				screensaver_background: 'photos',
				screensaver_photos: [FIRST, SECOND],
				screensaver_photo_order: 'sequence'
			});
			const { container } = await showScreensaver();
			await fireEvent.error(container.querySelector('img.slide')!);
			expect(slides(container)).toEqual([`${'b'.repeat(32)}.jpg`]);
			await fireEvent.error(container.querySelector('img.slide')!);
			expect(container.querySelector('img.slide')).toBeNull();
			expect(container.querySelector('.scrim')).toBeNull();
		});

		it('holds the photo while the page is hidden', async () => {
			configure({
				screensaver_background: 'photos',
				screensaver_photos: [FIRST, SECOND],
				screensaver_photo_order: 'sequence',
				screensaver_photo_seconds: 10
			});
			const { container } = await showScreensaver();
			Object.defineProperty(document, 'hidden', { configurable: true, value: true });
			document.dispatchEvent(new Event('visibilitychange'));
			await tick();
			expect(container.querySelector('.photos.paused')).not.toBeNull();
			vi.advanceTimersByTime(60_000);
			await tick();
			expect(slides(container)).toEqual([`${'a'.repeat(32)}.webp`]);

			Object.defineProperty(document, 'hidden', { configurable: true, value: false });
			document.dispatchEvent(new Event('visibilitychange'));
			vi.advanceTimersByTime(10_000);
			await tick();
			expect(slides(container)).toEqual([`${'b'.repeat(32)}.jpg`]);
		});
	});

	it('paints the sky from the sun', async () => {
		states.set({
			'sun.sun': {
				entity_id: 'sun.sun',
				state: 'below_horizon',
				attributes: { elevation: -1, rising: false }
			}
		} as unknown as HassEntities);
		configure({ screensaver_background: 'sun' });
		const { container } = await showScreensaver();
		const sky = container.querySelector('.sky') as HTMLElement;
		expect(sky.dataset.phase).toBe('dusk');
		expect(sky.style.getPropertyValue('--sky-bottom')).toMatch(/^rgb\(/);
		expect(container.querySelector('.scrim')).not.toBeNull();
	});

	describe('now playing', () => {
		const PLAYING = {
			'media_player.living': {
				entity_id: 'media_player.living',
				state: 'playing',
				attributes: {
					media_title: 'Blue in Green',
					media_artist: 'Miles Davis',
					entity_picture: '/api/media_player_proxy/media_player.living'
				}
			}
		};

		it('shows the track over its blurred art', async () => {
			states.set(PLAYING as unknown as HassEntities);
			configure({ screensaver_background: 'media' });
			const { container } = await showScreensaver();
			expect(container.querySelector('.track-title')?.textContent).toBe('Blue in Green');
			expect(container.querySelector('.track-artist')?.textContent).toBe('Miles Davis');
			expect(container.querySelector('img.art-backdrop')).not.toBeNull();
			expect(container.querySelector('img.art')).not.toBeNull();
			expect(container.querySelector('.scrim')).not.toBeNull();
		});

		it('hands over to the fallback background once the music stops', async () => {
			states.set(PLAYING as unknown as HassEntities);
			configure({
				screensaver_background: 'media',
				screensaver_media_entity: 'media_player.living',
				screensaver_media_fallback: 'image',
				screensaver_image: 'https://example.com/a.jpg'
			});
			const { container } = await showScreensaver();
			expect(container.querySelector('img.photo')).toBeNull();

			states.set({
				'media_player.living': { ...PLAYING['media_player.living'], state: 'paused' }
			} as unknown as HassEntities);
			await tick();
			// held a moment, so a skip between songs does not flash the fallback
			vi.advanceTimersByTime(4_000);
			await tick();
			expect(container.querySelector('.now-playing')).not.toBeNull();
			states.set({
				'media_player.living': { ...PLAYING['media_player.living'], state: 'buffering' }
			} as unknown as HassEntities);
			await tick();
			states.set({
				'media_player.living': { ...PLAYING['media_player.living'], state: 'idle' }
			} as unknown as HassEntities);
			await tick();
			vi.advanceTimersByTime(4_000);
			await tick();
			expect(container.querySelector('.now-playing')).not.toBeNull();
			vi.advanceTimersByTime(1_000);
			await tick();
			expect(container.querySelector('.now-playing')).toBeNull();
			expect(container.querySelector('img.art-backdrop')).toBeNull();
			expect(container.querySelector('img.photo')).not.toBeNull();
		});

		it('keeps failed art away until the address changes or the screen sleeps again', async () => {
			states.set(PLAYING as unknown as HassEntities);
			configure({ screensaver_background: 'media' });
			const { container, overlay } = await showScreensaver();
			await fireEvent.error(container.querySelector('img.art')!);
			expect(container.querySelector('img.art')).toBeNull();
			expect(container.querySelector('img.art-backdrop')).toBeNull();

			const living = PLAYING['media_player.living'];
			states.set({
				'media_player.living': { ...living, attributes: { ...living.attributes, volume: 0.5 } }
			} as unknown as HassEntities);
			await tick();
			expect(container.querySelector('img.art')).toBeNull();

			states.set({
				'media_player.living': {
					...living,
					attributes: { ...living.attributes, entity_picture: '/api/next' }
				}
			} as unknown as HassEntities);
			await tick();
			expect(container.querySelector('img.art')?.getAttribute('src')).toBe('/api/next');
			await fireEvent.error(container.querySelector('img.art')!);

			await fireEvent.keyDown(overlay, { key: 'a' });
			vi.advanceTimersByTime(60_000);
			await tick();
			expect(container.querySelector('img.art')?.getAttribute('src')).toBe('/api/next');
		});

		it('stays plain black while nothing plays and no fallback is set', async () => {
			configure({ screensaver_background: 'media' });
			const { container } = await showScreensaver();
			expect(container.querySelector('.now-playing')).toBeNull();
			expect(container.querySelector('.scrim')).toBeNull();
		});
	});
});
