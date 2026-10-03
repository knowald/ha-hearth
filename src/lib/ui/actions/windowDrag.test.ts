import { describe, expect, it, vi } from 'vitest';
import { clampToViewport, windowDrag, type WindowPosition } from './windowDrag';

const SIZE = { width: 420, height: 680 };
const VIEWPORT = { width: 1280, height: 800 };

describe('clampToViewport', () => {
	it('leaves a position inside the viewport alone', () => {
		expect(clampToViewport({ x: 300, y: 120 }, SIZE, VIEWPORT)).toEqual({ x: 300, y: 120 });
	});

	it('keeps a sliver on screen when dragged off the left or the top', () => {
		expect(clampToViewport({ x: -5000, y: -5000 }, SIZE, VIEWPORT)).toEqual({ x: -396, y: 0 });
	});

	it('keeps the header reachable when dragged off the right or the bottom', () => {
		expect(clampToViewport({ x: 5000, y: 5000 }, SIZE, VIEWPORT)).toEqual({ x: 1256, y: 776 });
	});

	it('pulls a remembered position back in after the viewport shrinks', () => {
		const remembered = { x: 828, y: 32 };
		expect(clampToViewport(remembered, SIZE, { width: 600, height: 400 })).toEqual({
			x: 576,
			y: 32
		});
	});
});

describe('windowDrag', () => {
	it('moves the window in its own CSS pixels under a zoom', () => {
		const handle = document.createElement('div');
		Object.defineProperty(handle, 'currentCSSZoom', { value: 2 });
		const move = vi.fn<(position: WindowPosition) => void>();
		const action = windowDrag(handle, {
			position: () => ({ x: 100, y: 50 }),
			size: () => ({ width: 200, height: 100 }),
			move
		});
		const pointer = (type: string, x: number, y: number) =>
			handle.dispatchEvent(
				new PointerEvent(type, { pointerId: 1, button: 0, clientX: x, clientY: y })
			);
		pointer('pointerdown', 220, 120);
		pointer('pointermove', 420, 220);
		expect(move).toHaveBeenLastCalledWith({ x: 200, y: 100 });
		action?.destroy?.();
	});
});
