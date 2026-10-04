import { getContext, setContext } from 'svelte';
import type { Action } from 'svelte/action';
import { vibrate } from '$lib/core/app/haptics';

export type HearthInteractionMode = 'runtime' | 'layout-edit' | 'preview';
type HearthInteractionSource = HearthInteractionMode | (() => HearthInteractionMode);

const INTERACTION_MODE = Symbol('hearth-interaction-mode');

/** Sets the interaction contract inherited by a rendered Hearth subtree. */
export function provideHearthInteractionMode(source: HearthInteractionSource) {
	setContext(INTERACTION_MODE, source);
}

/** Runtime is the default for cards rendered outside an explicit wrapper. */
export function getHearthInteractionMode(): HearthInteractionMode {
	const source = getContext<HearthInteractionSource | undefined>(INTERACTION_MODE);
	return typeof source === 'function' ? source() : (source ?? 'runtime');
}

/** Adds native-button Enter/Space behavior to composite controls. */
export function activateOnKeyboard(event: KeyboardEvent, action: () => void) {
	if (event.key !== 'Enter' && event.key !== ' ') return;
	event.preventDefault();
	action();
}

interface LongPressOptions {
	hold: () => void;
	disabled?: boolean;
	/**
	 * On touch, run `hold` at the release instead of at the threshold. A
	 * browser only lets a touch open a tab from the release (user activation),
	 * so configured hold actions such as `url` need it.
	 */
	deferOnTouch?: boolean;
}

/** How long a press lasts before it counts as a hold. */
export const HOLD_MS = 500;

/**
 * Long-press for tiles without a drag gesture: 500ms without moving more than
 * 10px fires `hold` and swallows the click that follows the release.
 */
export const longPress: Action<HTMLElement, LongPressOptions> = (node, options) => {
	let current = options;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let start: { x: number; y: number } | null = null;
	let held = false;
	// a touch hold past the threshold, waiting for its release
	let deferred = false;

	function handleDown(event: PointerEvent) {
		if (current.disabled || event.isPrimary === false) return;
		held = false;
		deferred = false;
		start = { x: event.clientX, y: event.clientY };
		const defer = Boolean(current.deferOnTouch) && event.pointerType === 'touch';
		clearTimeout(timer);
		timer = setTimeout(() => {
			held = true;
			vibrate('hold');
			if (defer) deferred = true;
			else current.hold();
		}, HOLD_MS);
	}

	function handleUp() {
		cancel();
		if (!deferred) return;
		deferred = false;
		current.hold();
	}

	function handleCancel() {
		deferred = false;
		cancel();
	}

	function handleMove(event: PointerEvent) {
		if (!start) return;
		if (Math.abs(event.clientX - start.x) > 10 || Math.abs(event.clientY - start.y) > 10) cancel();
	}

	function cancel() {
		clearTimeout(timer);
		start = null;
	}

	// capture phase, so the tile's own onclick never sees a post-hold release
	function handleClick(event: MouseEvent) {
		if (!held) return;
		held = false;
		event.stopPropagation();
		event.preventDefault();
	}

	node.addEventListener('pointerdown', handleDown);
	node.addEventListener('pointermove', handleMove);
	node.addEventListener('pointerup', handleUp);
	node.addEventListener('pointercancel', handleCancel);
	node.addEventListener('click', handleClick, true);

	return {
		update(next: LongPressOptions) {
			current = next;
		},
		destroy() {
			clearTimeout(timer);
			node.removeEventListener('pointerdown', handleDown);
			node.removeEventListener('pointermove', handleMove);
			node.removeEventListener('pointerup', handleUp);
			node.removeEventListener('pointercancel', handleCancel);
			node.removeEventListener('click', handleClick, true);
		}
	};
};
