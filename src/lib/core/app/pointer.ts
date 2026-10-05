/*
 * The primary pointer, read when asked rather than kept live: callers decide
 * once per gesture or mount. Without media query support both answer false.
 */

function matches(query: string): boolean {
	return typeof matchMedia === 'function' && matchMedia(query).matches;
}

/** A mouse or trackpad drives the page. */
export function finePointer(): boolean {
	return matches('(pointer: fine)');
}

/** A finger drives the page. */
export function coarsePointer(): boolean {
	return matches('(pointer: coarse)');
}
