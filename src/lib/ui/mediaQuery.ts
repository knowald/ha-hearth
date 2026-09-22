import { readable, type Readable } from 'svelte/store';

/*
 * A media query as a store, for the cases CSS cannot cover on its own: which
 * component to render, which props to pass. Anything that is only a matter of
 * appearance belongs in a stylesheet instead.
 */

const cache = new Map<string, Readable<boolean>>();

/** Whether `query` matches, kept live. Always false without a browser. */
export function mediaQuery(query: string): Readable<boolean> {
	const existing = cache.get(query);
	if (existing) return existing;

	const store =
		typeof window === 'undefined' || typeof window.matchMedia !== 'function'
			? readable(false)
			: readable(window.matchMedia(query).matches, (set) => {
					const list = window.matchMedia(query);
					const sync = () => set(list.matches);
					list.addEventListener('change', sync);
					sync();
					return () => list.removeEventListener('change', sync);
				});

	cache.set(query, store);
	return store;
}
