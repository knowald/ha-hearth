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
export const TAP_SLOP = 10;

/**
 * In edit mode, a tap anywhere on an item opens its editor, through one
 * listener on the container that finds the item from the tap's target. Enter
 * or Space on a focused tile does the same for the keyboard. A tap that opens
 * an editor stops there: the card's own handlers are delegated to the root,
 * and a stepper or seek bar must not act on the tap that opened its editor.
 */
export const editTap: Action<HTMLElement, EditTapOptions> = (node, options) => {
	let current = options;
	let press: { x: number; y: number; ownGesture: boolean } | null = null;

	function ownGesture(target: EventTarget | null) {
		return target instanceof Element && target.closest(OWN_GESTURE) !== null;
	}

	function handleDown(event: PointerEvent) {
		// a second finger is a pinch or a stray touch, not a new tap
		if (event.isPrimary === false) return;
		press = { x: event.clientX, y: event.clientY, ownGesture: ownGesture(event.target) };
	}

	function handleCancel() {
		press = null;
	}

	function handleClick(event: MouseEvent) {
		const started = press;
		press = null;
		if (!current.enabled || event.defaultPrevented || !(event.target instanceof Element)) return;
		if (ownGesture(event.target) || started?.ownGesture) return;
		// detail 0 is a click from the keyboard or assistive technology, with no pointer to have moved
		if (
			event.detail !== 0 &&
			started &&
			(Math.abs(event.clientX - started.x) > TAP_SLOP ||
				Math.abs(event.clientY - started.y) > TAP_SLOP)
		)
			return;
		if (current.open(event.target)) event.stopPropagation();
	}

	function handleKey(event: KeyboardEvent) {
		if (!current.enabled || (event.key !== 'Enter' && event.key !== ' ')) return;
		const target = event.target;
		// native controls and add tiles answer the key themselves
		if (!(target instanceof Element) || target.getAttribute('role') !== 'button') return;
		if (ownGesture(target)) return;
		if (!current.open(target)) return;
		event.preventDefault();
		event.stopPropagation();
	}

	node.addEventListener('pointerdown', handleDown);
	node.addEventListener('pointercancel', handleCancel);
	node.addEventListener('click', handleClick);
	node.addEventListener('keydown', handleKey);

	return {
		update(next: EditTapOptions) {
			current = next;
		},
		destroy() {
			node.removeEventListener('pointerdown', handleDown);
			node.removeEventListener('pointercancel', handleCancel);
			node.removeEventListener('click', handleClick);
			node.removeEventListener('keydown', handleKey);
		}
	};
};
