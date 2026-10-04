import { get } from 'svelte/store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseFavorites } from './favorites';

async function freshModules() {
	vi.resetModules();
	const store = await import('./store');
	const favorites = await import('./favorites');
	return { ...store, ...favorites };
}

describe('parseFavorites', () => {
	it('keeps entity ids once each and drops the rest', () => {
		expect(
			parseFavorites(
				JSON.stringify({
					entities: ['light.desk', 'light.desk', 'not an id', 4, 'switch.fan'],
					page: false
				})
			)
		).toEqual({ entities: ['light.desk', 'switch.fan'], page: false });
	});

	it('starts empty with the page on from a missing or broken entry', () => {
		const empty = { entities: [], page: true };
		expect(parseFavorites(null)).toEqual(empty);
		expect(parseFavorites('{oops')).toEqual(empty);
		expect(parseFavorites('5')).toEqual(empty);
		expect(parseFavorites(JSON.stringify({ entities: 'light.desk' }))).toEqual(empty);
	});
});

describe('favorites', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		localStorage.clear();
	});

	it('starts from what this browser stored', async () => {
		localStorage.setItem('hearthFavorites', JSON.stringify({ entities: ['light.desk'] }));
		const { favorites } = await freshModules();
		expect(get(favorites)).toEqual({ entities: ['light.desk'], page: true });
	});

	it('stars, unstars and stores the list', async () => {
		const { favorites, toggleFavorite, favoritesPageOffered } = await freshModules();
		expect(get(favoritesPageOffered)).toBe(false);

		toggleFavorite('light.desk');
		toggleFavorite('switch.fan');
		toggleFavorite('light.desk');

		expect(get(favorites).entities).toEqual(['switch.fan']);
		expect(JSON.parse(localStorage.getItem('hearthFavorites')!)).toEqual({
			entities: ['switch.fan'],
			page: true
		});
		expect(get(favoritesPageOffered)).toBe(true);
	});

	it('removes several favorites at once', async () => {
		const { favorites, removeFavorites, toggleFavorite } = await freshModules();
		toggleFavorite('light.desk');
		toggleFavorite('switch.fan');
		toggleFavorite('sensor.gone');
		removeFavorites(['sensor.gone', 'light.desk']);
		expect(get(favorites).entities).toEqual(['switch.fan']);
	});

	it('closes when a page is asked for, even the one it covers', async () => {
		const { currentRoom, favoritesOpen, goToPage, toggleFavorite } = await freshModules();
		toggleFavorite('light.desk');
		currentRoom.set('office');
		favoritesOpen.set(true);

		goToPage('office');
		expect(get(favoritesOpen)).toBe(false);
		expect(get(currentRoom)).toBe('office');
	});

	it('keeps the list while the page is turned off', async () => {
		const { favoritesPageOffered, showFavoritesPage, toggleFavorite } = await freshModules();
		toggleFavorite('light.desk');
		showFavoritesPage(false);
		expect(get(favoritesPageOffered)).toBe(false);
	});

	it('works for the session when storage throws', async () => {
		vi.stubGlobal('localStorage', {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('blocked');
			}
		});
		const { favorites, toggleFavorite } = await freshModules();
		expect(get(favorites)).toEqual({ entities: [], page: true });
		toggleFavorite('light.desk');
		expect(get(favorites).entities).toEqual(['light.desk']);
	});

	it('closes the page when another page is picked, edit mode starts or the list empties', async () => {
		const { currentRoom, favoritesOpen, hearthEditMode, toggleFavorite } = await freshModules();
		toggleFavorite('light.desk');

		favoritesOpen.set(true);
		currentRoom.set('office');
		expect(get(favoritesOpen)).toBe(false);

		favoritesOpen.set(true);
		hearthEditMode.set(true);
		expect(get(favoritesOpen)).toBe(false);
		hearthEditMode.set(false);

		favoritesOpen.set(true);
		toggleFavorite('light.desk');
		expect(get(favoritesOpen)).toBe(false);
	});
});
