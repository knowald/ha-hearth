import { getContext, setContext, untrack } from 'svelte';

const SEARCH = Symbol('settings-search');
const SECTION = Symbol('settings-section');

/** The settings sheet's search query and how many rows match it. */
export class SettingsSearch {
	query = $state('');
	matched = $state(0);

	get active() {
		return this.query.trim() !== '';
	}

	/** Case-insensitive: does any of `texts` contain the query? */
	matches(texts: readonly (string | undefined)[]) {
		const needle = this.query.trim().toLocaleLowerCase();
		return !needle || texts.some((text) => text?.toLocaleLowerCase().includes(needle));
	}
}

/**
 * How many rows of one section match the search, so it can hide when none
 * do, and its title, since a query naming the section shows all of it.
 */
export class SectionMatches {
	count = $state(0);
	title = $state('');
}

export function provideSettingsSearch(search: SettingsSearch) {
	setContext(SEARCH, search);
}

export function provideSectionMatches() {
	const matches = new SectionMatches();
	setContext(SECTION, matches);
	return matches;
}

/** The search of the sheet around the caller, or undefined outside one. */
export function settingsSearch() {
	return getContext<SettingsSearch | undefined>(SEARCH);
}

/**
 * Whether a row showing `texts` stays visible under the current search, and
 * counts it towards its section and the sheet while it matches. Outside a
 * settings sheet every row shows. Call it during component init.
 */
export function searchMatch(texts: () => readonly (string | undefined)[]) {
	const search = settingsSearch();
	const section = getContext<SectionMatches | undefined>(SECTION);
	const visible = $derived(
		!search ||
			search.matches(texts()) ||
			(!!section && search.active && search.matches([section.title]))
	);

	$effect(() => {
		if (!search?.active || !visible) return;
		// the counters are written, never read, here; reading them would rerun this
		untrack(() => {
			search.matched += 1;
			if (section) section.count += 1;
		});
		return () =>
			untrack(() => {
				search.matched -= 1;
				if (section) section.count -= 1;
			});
	});

	return () => visible;
}
