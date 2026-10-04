import { derived, get, writable } from 'svelte/store';
import { currentRoom, favoritesOpen, hearthEditMode } from './store';

export { favoritesOpen };

/*
 * Entities this browser starred from their popup, shown on a page of their
 * own on phone-width screens. Like the device name they belong to the
 * browser and never reach hearth.yaml.
 */

export interface Favorites {
	entities: string[];
	/** False hides the page while keeping the list. */
	page: boolean;
}

const STORAGE_KEY = 'hearthFavorites';
const ENTITY_ID = /^[a-z0-9_]+\.[a-z0-9_]+$/;

/** Reads the stored list, dropping whatever a hand edit or an older version left malformed. */
export function parseFavorites(raw: string | null): Favorites {
	let stored: Record<string, unknown> | null = null;
	try {
		stored = JSON.parse(raw ?? 'null');
	} catch {
		// a malformed entry starts the list over
	}
	const entities = Array.isArray(stored?.entities)
		? stored.entities.filter(
				(entity): entity is string => typeof entity === 'string' && ENTITY_ID.test(entity)
			)
		: [];
	return { entities: [...new Set(entities)], page: stored?.page !== false };
}

function load(): Favorites {
	try {
		return parseFavorites(localStorage.getItem(STORAGE_KEY));
	} catch {
		// no window during SSR, or storage blocked by the browser
		return parseFavorites(null);
	}
}

export const favorites = writable<Favorites>(load());

function store(change: (current: Favorites) => Favorites) {
	const next = change(get(favorites));
	favorites.set(next);
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
	} catch {
		// storage blocked: the list still holds until the page reloads
	}
}

export function toggleFavorite(entity: string) {
	store((current) => ({
		...current,
		entities: current.entities.includes(entity)
			? current.entities.filter((entry) => entry !== entity)
			: [...current.entities, entity]
	}));
}

export function removeFavorites(entities: string[]) {
	store((current) => ({
		...current,
		entities: current.entities.filter((entry) => !entities.includes(entry))
	}));
}

export function showFavoritesPage(show: boolean) {
	store((current) => ({ ...current, page: show }));
}

/** The page is offered while there is something on it and it is not turned off. */
export const favoritesPageOffered = derived(
	favorites,
	($favorites) => $favorites.page && $favorites.entities.length > 0
);

// another page being picked leaves it (goToPage covers the page it covers),
// and so do edit mode, which arranges shared pages only, and an emptied list
const leave = (stay: unknown) => {
	if (!stay) favoritesOpen.set(false);
};
currentRoom.subscribe(() => leave(false));
hearthEditMode.subscribe((editing) => leave(!editing));
favoritesPageOffered.subscribe(leave);
