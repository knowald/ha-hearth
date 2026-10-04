import { fireEvent, render, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import { english as en } from '$lib/core/i18n/testing';
import FavoritesPage from './FavoritesPage.svelte';
import { favorites, removeFavorites, toggleFavorite } from './favorites';

describe('FavoritesPage', () => {
	beforeEach(() => {
		for (const entity of ['switch.pump', 'light.gone', 'sensor.broken']) toggleFavorite(entity);
	});

	afterEach(() => {
		removeFavorites(get(favorites).entities);
		states.set(undefined as never);
		localStorage.clear();
	});

	it('says nothing is missing before the states are in', () => {
		states.set(undefined as never);
		render(FavoritesPage);
		expect(screen.queryByRole('button', { name: en.hearth_remove_missing })).toBeNull();
	});

	it('offers to remove the favorites Home Assistant no longer has', async () => {
		states.set({
			'switch.pump': hassEntity('switch.pump', 'on', { friendly_name: 'Pump' }),
			'sensor.broken': hassEntity('sensor.broken', 'unavailable')
		});
		render(FavoritesPage);
		expect(screen.getByText('1 favorite is no longer in Home Assistant')).toBeTruthy();

		await fireEvent.click(screen.getByRole('button', { name: en.hearth_remove_missing }));
		expect(get(favorites).entities).toEqual(['switch.pump', 'sensor.broken']);
	});

	it('lists every favorite with its own remove button', async () => {
		states.set({
			'switch.pump': hassEntity('switch.pump', 'on', { friendly_name: 'Pump' }),
			'sensor.broken': hassEntity('sensor.broken', 'unavailable')
		});
		render(FavoritesPage);
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_edit_favorites }));
		const list = screen.getByRole('list');
		expect(list.textContent).toContain(en.unavailable);
		expect(list.textContent).toContain(en.hearth_missing_entity);

		await fireEvent.click(screen.getByRole('button', { name: 'Remove Pump' }));
		expect(get(favorites).entities).toEqual(['light.gone', 'sensor.broken']);
	});
});
