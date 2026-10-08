import type { Action } from 'svelte/action';

export const PIXEL_SHIFT_INTERVAL = 60_000;
const QUIET_MS = 5000;
// Visit every integer offset in the 9 x 9 square, starting at its centre.
// Relatively prime steps spread consecutive positions over both axes.
export function pixelShiftPosition(step: number) {
	return { x: ((4 + step * 5) % 9) - 4, y: ((4 + Math.floor(step / 9) + step * 4) % 9) - 4 };
}

interface Options {
	enabled: boolean;
	paused: boolean;
}

/** Discrete shifts keep reduced motion usable, without an animation loop.
 * Keep the last position while interacting: resetting would move a control
 * under the very pointer that paused us. No transform on an overlay ancestor.
 */
export const pixelShift: Action<HTMLElement, Options> = (node, options) => {
	let current = options;
	let step = 0;
	let lastActivity = -Infinity;
	const pointers = new Set<number>();
	let timer: ReturnType<typeof setTimeout> | undefined;

	function clearPosition() {
		node.style.removeProperty('--h-shift-x');
		node.style.removeProperty('--h-shift-y');
		step = 0;
	}

	function schedule() {
		clearTimeout(timer);
		if (!current.enabled || document.visibilityState === 'hidden') return;
		timer = setTimeout(() => {
			if (!current.paused && !pointers.size && Date.now() - lastActivity >= QUIET_MS) {
				const { x, y } = pixelShiftPosition(++step);
				node.style.setProperty('--h-shift-x', `calc(${x}px / var(--h-zoom))`);
				node.style.setProperty('--h-shift-y', `calc(${y}px / var(--h-zoom))`);
			}
			schedule();
		}, PIXEL_SHIFT_INTERVAL);
	}

	function activity(event: Event) {
		lastActivity = Date.now();
		if (event.type === 'pointerdown') pointers.add((event as PointerEvent).pointerId);
		if (event.type === 'pointerup' || event.type === 'pointercancel') {
			pointers.delete((event as PointerEvent).pointerId);
		}
	}
	function visibility() {
		pointers.clear();
		lastActivity = Date.now();
		schedule();
	}
	const events = [
		'pointerdown',
		'pointerup',
		'pointercancel',
		'pointermove',
		'keydown',
		'wheel',
		'scroll'
	];
	for (const name of events)
		window.addEventListener(name, activity, { capture: true, passive: true });
	document.addEventListener('visibilitychange', visibility);
	window.addEventListener('blur', visibility);
	schedule();

	return {
		update(next) {
			const changed = current.enabled !== next.enabled;
			current = next;
			if (!next.enabled) clearPosition();
			if (changed) schedule();
		},
		destroy() {
			clearTimeout(timer);
			clearPosition();
			for (const name of events) window.removeEventListener(name, activity, true);
			document.removeEventListener('visibilitychange', visibility);
			window.removeEventListener('blur', visibility);
		}
	};
};
