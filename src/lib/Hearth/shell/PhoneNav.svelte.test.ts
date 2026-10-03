import { act, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../static/translations/en.json';
import { motion } from '$lib/core/app/motion';
import { selectedLanguage } from '$lib/core/i18n';
import { states } from '$lib/core/ha/entities';
import { MOTION } from '$lib/core/theme';
import { DEFAULT_HEARTH_CONFIG, type HearthConfig, type RailWidget } from '../config';
import { currentRoom, hearthConfig } from '../store';
import PhoneNav from './PhoneNav.svelte';

function configure(rail: RailWidget[], settings: Partial<HearthConfig> = {}) {
	hearthConfig.set({
		...structuredClone(DEFAULT_HEARTH_CONFIG),
		...settings,
		rail,
		rooms: [
			{ id: 'home', name: 'Home', icon: 'home', cards: [[]] },
			{ id: 'kitchen', name: 'Kitchen', icon: 'kitchen', cards: [[]] }
		]
	});
}

describe('PhoneNav', () => {
	const scrollIntoView = vi.fn();

	beforeEach(() => {
		states.set({});
		Element.prototype.scrollIntoView = scrollIntoView;
	});

	afterEach(() => {
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
		currentRoom.set('home');
		motion.set(MOTION.base);
		scrollIntoView.mockReset();
	});

	it('offers search only when the search widget is shown on mobile', async () => {
		const searchButton = () => screen.queryByRole('button', { name: en.search });
		configure([{ id: 'search', type: 'search', visibility: [{ entity: 'input_boolean.guests' }] }]);
		render(PhoneNav, { onsearch: () => {} });
		expect(searchButton()).toBeNull();

		await act(() => states.set({ 'input_boolean.guests': { state: 'on' } } as never));
		expect(searchButton()).not.toBeNull();

		// an explicit slot overrides the legacy flag, as in the folded rail
		await act(() =>
			configure([{ id: 'search', type: 'search', hide_mobile: true, mobile: 'top' }])
		);
		expect(searchButton()).not.toBeNull();
		await act(() => configure([{ id: 'search', type: 'search', mobile: 'hidden' }]));
		expect(searchButton()).toBeNull();
	});

	it('scrolls the active page into view when the page changes elsewhere', async () => {
		configure([]);
		render(PhoneNav, { onsearch: () => {} });
		scrollIntoView.mockReset();
		await act(() => currentRoom.set('kitchen'));
		expect(scrollIntoView).toHaveBeenCalledWith({
			inline: 'nearest',
			block: 'nearest',
			behavior: 'smooth'
		});
		expect(scrollIntoView.mock.contexts.at(-1)).toBe(
			screen.getByRole('button', { name: 'Kitchen' })
		);

		await act(() => motion.set(0));
		await act(() => currentRoom.set('home'));
		expect(scrollIntoView).toHaveBeenLastCalledWith(expect.objectContaining({ behavior: 'auto' }));
	});

	describe('clock', () => {
		beforeEach(() => {
			vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-03-05T17:04:00Z') });
			selectedLanguage.set('en-US');
		});

		afterEach(() => {
			vi.useRealTimers();
			selectedLanguage.set(undefined as never);
		});

		const clock = () => document.querySelector('time');

		it('is off by default', () => {
			configure([]);
			render(PhoneNav, { onsearch: () => {} });
			expect(clock()).toBeNull();
		});

		it('shows the time over a short date when turned on', () => {
			configure([{ id: 'clock', type: 'clock', timezone: 'UTC' }], { phone_clock: true });
			render(PhoneNav, { onsearch: () => {} });
			expect(clock()?.getAttribute('datetime')).toBe('2026-03-05T17:04:00.000Z');
			expect(clock()?.textContent).toContain('Thu, Mar 5');
			expect(screen.queryByRole('button', { name: /Thu/ })).toBeNull();
		});

		it('follows the rail clock hour format and zone', async () => {
			configure([{ id: 'clock', type: 'clock', timezone: 'UTC', hour_format: '24' }], {
				phone_clock: true
			});
			render(PhoneNav, { onsearch: () => {} });
			expect(clock()?.textContent).toContain('17:04');

			await act(() =>
				configure([{ id: 'clock', type: 'clock', timezone: 'Asia/Tokyo', hour_format: '12' }], {
					phone_clock: true
				})
			);
			expect(clock()?.textContent).toMatch(/02:04\sAM/);
			expect(clock()?.textContent).toContain('Fri, Mar 6');
		});
	});
});
