import { act, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../static/translations/en.json';
import { motion } from '$lib/core/app/motion';
import { states } from '$lib/core/ha/entities';
import { MOTION } from '$lib/core/theme';
import { DEFAULT_HEARTH_CONFIG, type RailWidget } from '../config';
import { currentRoom, hearthConfig } from '../store';
import PhoneNav from './PhoneNav.svelte';

function configure(rail: RailWidget[]) {
	hearthConfig.set({
		...structuredClone(DEFAULT_HEARTH_CONFIG),
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
});
