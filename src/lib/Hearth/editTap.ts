import type { Action } from 'svelte/action';

interface EditTapOptions {
	enabled: boolean;
	/** Called with the element a tap landed on; returns whether it opened an editor. */
	open: (target: Element) => boolean;
}

// the grips start a drag, and the chips and add tiles have their own actions
const OWN_GESTURE = '.drag-handle, .entity-drag-handle, .chip, .add-tile';

/*
 * The browser fires a click at the common ancestor of where a mouse drag
 * started and ended, so a short drag by a grip would read as a tap on its
 * card. A press that started on a grip, or moved like a drag, is not a tap.
 */
const TAP_SLOP = 10;

/**
 * In edit mode, a tap anywhere on an item opens its editor, through one
 * listener on the container that finds the item from the tap's target. Enter
 * or Space on a focused tile does the same for the keyboard.
 */
export const editTap: Action<HTMLElement, EditTapOptions> = (node, options) => {
	let current = options;
	let press: { x: number; y: number; ownGesture: boolean } | null = null;

	function ownGesture(target: EventTarget | null) {
		return target instanceof Element && target.closest(OWN_GESTURE) !== null;
	}

	function handleDown(event: PointerEvent) {
		press = { x: event.clientX, y: event.clientY, ownGesture: ownGesture(event.target) };
	}

	function handleClick(event: MouseEvent) {
		const started = press;
		press = null;
		if (!current.enabled || event.defaultPrevented || !(event.target instanceof Element)) return;
		if (ownGesture(event.target) || started?.ownGesture) return;
		if (
			started &&
			(Math.abs(event.clientX - started.x) > TAP_SLOP ||
				Math.abs(event.clientY - started.y) > TAP_SLOP)
		)
			return;
		current.open(event.target);
	}

	function handleKey(event: KeyboardEvent) {
		if (!current.enabled || (event.key !== 'Enter' && event.key !== ' ')) return;
		const target = event.target;
		// native controls and add tiles answer the key themselves
		if (!(target instanceof Element) || target.getAttribute('role') !== 'button') return;
		if (ownGesture(target)) return;
		if (current.open(target)) event.preventDefault();
	}

	node.addEventListener('pointerdown', handleDown);
	node.addEventListener('click', handleClick);
	node.addEventListener('keydown', handleKey);

	return {
		update(next: EditTapOptions) {
			current = next;
		},
		destroy() {
			node.removeEventListener('pointerdown', handleDown);
			node.removeEventListener('click', handleClick);
			node.removeEventListener('keydown', handleKey);
		}
	};
};
