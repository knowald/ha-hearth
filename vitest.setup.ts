import { readFileSync } from 'node:fs';
import { translation } from '$lib/core/i18n';

// components render through $lang(); load the English file so assertions can
// read the copy a user sees rather than translation keys
translation.set(JSON.parse(readFileSync('static/translations/en.json', 'utf8')));

// jsdom ships no ResizeObserver, and components that watch their own box are
// rendered here for reasons unrelated to layout
globalThis.ResizeObserver ??= class {
	observe() {}
	unobserve() {}
	disconnect() {}
} as unknown as typeof ResizeObserver;
