import { describe, expect, it } from 'vitest';
import { clampToViewport } from './windowDrag';

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
