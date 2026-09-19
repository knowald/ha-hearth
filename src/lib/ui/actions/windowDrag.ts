import type { Action } from 'svelte/action';

export interface WindowPosition {
	x: number;
	y: number;
}

interface WindowDragOptions {
	/** Current top-left of the dragged window, in px from the viewport origin. */
	position: () => WindowPosition;
	/** Size of the dragged window, used to keep it inside the viewport. */
	size: () => { width: number; height: number };
	move: (position: WindowPosition) => void;
	disabled?: boolean;
	/** Selector for controls inside the handle that keep their own clicks. */
	ignore?: string;
}

/** Pixels of the window that must stay on screen on every edge. */
const MARGIN = 24;

/**
 * Keeps a floating window reachable: it may hang off an edge, but never so far
 * that the header it is dragged by leaves the viewport.
 */
export function clampToViewport(
	position: WindowPosition,
	size: { width: number; height: number },
	viewport: { width: number; height: number }
): WindowPosition {
	return {
		x: Math.min(Math.max(position.x, MARGIN - size.width), viewport.width - MARGIN),
		y: Math.min(Math.max(position.y, 0), viewport.height - MARGIN)
	};
}

/**
 * Drags the window a handle belongs to. The handle only receives the gesture;
 * the caller owns the position and applies it, so the window can also be moved
 * by other means (a reset, a viewport resize).
 */
export const windowDrag: Action<HTMLElement, WindowDragOptions> = (node, options) => {
	let current = options;
	let tracking: { pointerId: number; offsetX: number; offsetY: number } | null = null;

	function handleDown(event: PointerEvent) {
		if (current.disabled || event.button !== 0) return;
		if (current.ignore && (event.target as Element).closest?.(current.ignore)) return;
		const start = current.position();
		tracking = {
			pointerId: event.pointerId,
			offsetX: event.clientX - start.x,
			offsetY: event.clientY - start.y
		};
		try {
			node.setPointerCapture(event.pointerId);
		} catch {
			// pointer capture is best-effort
		}
		event.preventDefault();
	}

	function handleMove(event: PointerEvent) {
		if (!tracking || event.pointerId !== tracking.pointerId) return;
		current.move(
			clampToViewport(
				{ x: event.clientX - tracking.offsetX, y: event.clientY - tracking.offsetY },
				current.size(),
				{ width: window.innerWidth, height: window.innerHeight }
			)
		);
	}

	function handleUp(event: PointerEvent) {
		if (!tracking || event.pointerId !== tracking.pointerId) return;
		tracking = null;
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
		update(next: WindowDragOptions) {
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
