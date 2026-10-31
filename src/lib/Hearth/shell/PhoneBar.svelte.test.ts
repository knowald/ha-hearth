import { act, fireEvent, render, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { english as en } from '$lib/core/i18n/testing';
import { states } from '$lib/core/ha/entities';
import { DEFAULT_HEARTH_CONFIG, type RailWidget } from '../config';
import { currentRoom, favoritesOpen, hearthConfig } from '../store';
import PhoneBar from './PhoneBar.svelte';

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

describe('PhoneBar', () => {
	const scrollIntoView = vi.fn();

	beforeEach(() => {
		states.set({});
		Element.prototype.scrollIntoView = scrollIntoView;
	});

	afterEach(() => {
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
		currentRoom.set('home');
		favoritesOpen.set(false);
		scrollIntoView.mockReset();
	});

	it('switches pages from its tabs', async () => {
		configure([]);
		render(PhoneBar, { onsearch: () => {} });
		const nav = screen.getByRole('navigation', { name: en.hearth_pages });
		const kitchen = screen.getByRole('button', { name: 'Kitchen' });
		expect(nav.contains(kitchen)).toBe(true);
		expect(screen.getByRole('button', { name: 'Home' }).getAttribute('aria-current')).toBe('page');

		await fireEvent.click(kitchen);
		expect(get(currentRoom)).toBe('kitchen');
		expect(kitchen.getAttribute('aria-current')).toBe('page');
		expect(scrollIntoView.mock.contexts.at(-1)).toBe(kitchen);
	});

	it('stands in for a search widget shown on mobile', async () => {
		const onsearch = vi.fn();
		configure([]);
		render(PhoneBar, { onsearch });
		expect(screen.queryByRole('button', { name: en.search })).toBeNull();

		await act(() => configure([{ id: 'search', type: 'search' }]));
		await fireEvent.click(screen.getByRole('button', { name: en.search }));
		expect(onsearch).toHaveBeenCalledOnce();

		await act(() => configure([{ id: 'search', type: 'search', mobile: 'hidden' }]));
		expect(screen.queryByRole('button', { name: en.search })).toBeNull();
	});

	it('holds the More menu unless a kiosk frame turned the menu off', async () => {
		configure([]);
		const { unmount } = render(PhoneBar, { onsearch: () => {} });
		expect(screen.getByRole('button', { name: en.hearth_more })).toBeTruthy();
		unmount();

		render(PhoneBar, { onsearch: () => {}, menu: false });
		expect(screen.queryByRole('button', { name: en.hearth_more })).toBeNull();
	});
});
