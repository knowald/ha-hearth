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

/*
 * jsdom has no layout, and its Range lacks the two measuring methods.
 * CodeMirror measures text through a Range on the frame after it mounts, so
 * a sheet with a code field (entity templates, YAML) threw from inside
 * whatever event ran next. Empty boxes are what a document without layout
 * would report.
 */
if (typeof Range !== 'undefined') {
	Range.prototype.getClientRects ??= function () {
		return Object.assign([], { item: () => null }) as unknown as DOMRectList;
	};
	Range.prototype.getBoundingClientRect ??= function () {
		return new DOMRect(0, 0, 0, 0);
	};
}
