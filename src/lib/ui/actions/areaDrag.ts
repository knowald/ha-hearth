import type { Action } from 'svelte/action';

interface AreaDragOptions {
	/** Pointer position as fractions of the element's box, clamped to 0-1. */
	move: (x: number, y: number) => void;
}

/**
 * Reports where a pointer is inside an element, from the press onward, so a tap
 * jumps to the spot and a drag follows it. Apply `touch-action: none` on the
 * element so touch drags are not stolen by the scroll container.
 */
export const areaDrag: Action<HTMLElement, AreaDragOptions> = (node, options) => {
	let current = options;
	let pointerId: number | null = null;

	function report(event: PointerEvent) {
		const rect = node.getBoundingClientRect();
		current.move(
			Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
			Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
		);
	}

	function handleDown(event: PointerEvent) {
		if (event.button !== 0) return;
		pointerId = event.pointerId;
		try {
			node.setPointerCapture(event.pointerId);
		} catch {
			// pointer capture is best-effort
		}
		event.preventDefault();
		report(event);
	}

	function handleMove(event: PointerEvent) {
		if (event.pointerId !== pointerId) return;
		report(event);
	}

	function handleUp(event: PointerEvent) {
		if (event.pointerId !== pointerId) return;
		pointerId = null;
		try {
			node.releasePointerCapture(event.pointerId);
		} catch {
			// the capture may already be gone
		}
	}

	node.addEventListener('pointerdown', handleDown);
	node.addEventListener('pointermove', handleMove);
	node.addEventListener('pointerup', handleUp);
	node.addEventListener('pointercancel', handleUp);

	return {
		update(next: AreaDragOptions) {
			current = next;
		},
		destroy() {
			node.removeEventListener('pointerdown', handleDown);
			node.removeEventListener('pointermove', handleMove);
			node.removeEventListener('pointerup', handleUp);
			node.removeEventListener('pointercancel', handleUp);
		}
	};
};
