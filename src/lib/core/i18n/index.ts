import { derived, writable } from 'svelte/store';

export interface Translations {
	[key: string]: string;
}

export const translation = writable<Translations>({});

/**
 * Combines the files of one locale (Home Assistant's strings, then Hearth's
 * own) into the shape lang() reads. English goes under _default so every key
 * a locale lacks falls back on its own.
 */
export function mergeTranslations(
	english: Translations[],
	local: Translations[] = []
): Translations {
	const fallback: Translations = Object.assign({}, ...english);
	if (!local.length) return fallback;
	return { ...Object.assign({}, ...local), _default: fallback };
}

export const selectedLanguage = writable<string>();

/**
 * Substitutes {name} placeholders in translated copy. Plain string
 * replacement would read "$&" in a value as a pattern; this does not.
 */
export function fill(text: string, values: Record<string, string | number>): string {
	return Object.entries(values).reduce(
		(out, [key, value]) => out.split(`{${key}}`).join(String(value)),
		text
	);
}

/** Looks a key up in the active locale, then English, then returns the key itself. */
export const lang = derived(
	translation,
	(obj: Translations & { _default?: Record<string, string> }) => (key: string) =>
		obj[key] || obj._default?.[key] || key
);
