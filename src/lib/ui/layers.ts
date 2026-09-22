import { get, readable } from 'svelte/store';
import { autocompleteOpen } from './codeEditorState';

/*
 * One stack for everything that opens above the page: sheets, popups,
 * popovers, pickers, confirmations, the search overlay. The layer on top owns
 * Escape, so nested overlays close one at a time in the order they opened and
 * no component needs its own window listener or propagation tricks. Window
 * shortcuts read the depth so they never open another layer over an open one.
 * A modal layer can also ask to keep Tab inside itself.
 */

interface Layer {
	close: () => void;
	trap?: () => HTMLElement | null;
}

const stack: Layer[] = [];
let notify: (depth: number) => void = () => {};

export const layerDepth = readable(0, (set) => {
	notify = set;
	set(stack.length);
	return () => {
		notify = () => {};
	};
});

const FOCUSABLE =
	'[tabindex]:not([tabindex="-1"]), a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"]';

/** Elements Tab can reach inside `root`, in document order. */
export function focusableIn(root: HTMLElement): HTMLElement[] {
	return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
		(element) =>
			element.tabIndex >= 0 &&
			!element.closest('[hidden], [inert]') &&
			// jsdom has no layout, so an element counts unless the browser says otherwise
			element.checkVisibility?.() !== false
	);
}

function cycleTab(event: KeyboardEvent, root: HTMLElement) {
	const focusable = focusableIn(root);
	const focused = document.activeElement;
	if (!focusable.length) {
		event.preventDefault();
		root.focus();
		return;
	}
	const first = focusable[0];
	const last = focusable[focusable.length - 1];
	const inside = focused instanceof Node && root.contains(focused);
	if (event.shiftKey && (!inside || focused === first || focused === root)) {
		event.preventDefault();
		last.focus();
	} else if (!event.shiftKey && (!inside || focused === last)) {
		event.preventDefault();
		first.focus();
	}
}

function handleKeydown(event: KeyboardEvent) {
	if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
	// an open completion list inside a code editor closes first
	if (get(autocompleteOpen)) return;
	const top = stack[stack.length - 1];
	if (!top) return;
	event.preventDefault();
	event.stopImmediatePropagation();
	top.close();
}

// bubble phase, so a control that uses Tab itself (a code editor indenting) claims it first
function handleTab(event: KeyboardEvent) {
	if (event.key !== 'Tab' || event.defaultPrevented) return;
	const root = stack[stack.length - 1]?.trap?.();
	if (root) cycleTab(event, root);
}

function register(layer: Layer): () => void {
	if (typeof window === 'undefined') return () => {};
	if (stack.length === 0) {
		window.addEventListener('keydown', handleKeydown, true);
		window.addEventListener('keydown', handleTab);
	}
	stack.push(layer);
	notify(stack.length);
	return () => {
		const index = stack.indexOf(layer);
		if (index === -1) return;
		stack.splice(index, 1);
		if (stack.length === 0) {
			window.removeEventListener('keydown', handleKeydown, true);
			window.removeEventListener('keydown', handleTab);
		}
		notify(stack.length);
	};
}

/** Register an open layer; call the returned function when it closes. */
export function pushLayer(close: () => void): () => void {
	return register({ close });
}

export interface LayerOptions {
	close: () => void;
	/** Keep Tab inside the node while this is the top layer. */
	trap?: boolean;
	/**
	 * Move focus in on open: `true` takes the first focusable element (or the
	 * node itself), a function picks the element. Skipped when focus is already
	 * inside, e.g. an input that focused itself.
	 */
	initialFocus?: boolean | ((node: HTMLElement) => HTMLElement | null | undefined);
}

function normalize(options: LayerOptions | (() => void)): LayerOptions {
	return typeof options === 'function' ? { close: options } : options;
}

/** Svelte action form: the node is a layer while mounted. */
export function layer(node: HTMLElement, options: LayerOptions | (() => void)) {
	let current = normalize(options);
	const opener = document.activeElement;
	const release = register({
		close: () => current.close(),
		trap: () => (current.trap ? node : null)
	});

	const { initialFocus } = current;
	const focused = document.activeElement;
	if (initialFocus && !(focused && focused !== document.body && node.contains(focused))) {
		const target =
			(typeof initialFocus === 'function' ? initialFocus(node) : null) ??
			focusableIn(node)[0] ??
			node;
		target.focus();
	}

	return {
		update(next: LayerOptions | (() => void)) {
			current = normalize(next);
		},
		destroy() {
			release();
			// only when focus is still inside the closing layer (or lost): a
			// click elsewhere already moved it and must win
			const focused = document.activeElement;
			if (
				opener instanceof HTMLElement &&
				opener.isConnected &&
				(!focused || focused === document.body || node.contains(focused))
			) {
				opener.focus();
			}
		}
	};
}
