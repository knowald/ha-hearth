import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pixelShift, pixelShiftPosition, PIXEL_SHIFT_INTERVAL } from './pixelShift';

describe('pixelShift', () => {
	let node: HTMLElement;
	let action: ReturnType<typeof pixelShift>;
	beforeEach(() => {
		vi.useFakeTimers();
		node = document.createElement('section');
		action = pixelShift(node, { enabled: true, paused: false });
	});
	afterEach(() => {
		action?.destroy?.();
		vi.restoreAllMocks();
		vi.useRealTimers();
	});
	const tick = () => vi.advanceTimersByTime(PIXEL_SHIFT_INTERVAL);
	const x = () => node.style.getPropertyValue('--h-shift-x');
	const pointer = (type: string) => window.dispatchEvent(new PointerEvent(type, { pointerId: 1 }));

	it('covers every offset within four pixels and repeats from the centre', () => {
		const positions = Array.from({ length: 81 }, (_, step) => pixelShiftPosition(step));
		expect(new Set(positions.map(({ x, y }) => `${x},${y}`)).size).toBe(81);
		for (const { x, y } of positions) {
			expect(Math.abs(x)).toBeLessThanOrEqual(4);
			expect(Math.abs(y)).toBeLessThanOrEqual(4);
		}
		expect(pixelShiftPosition(0)).toEqual({ x: 0, y: 0 });
		expect(pixelShiftPosition(81)).toEqual({ x: 0, y: 0 });
	});

	it('steps once a minute, holds position in dialogs and clears it when disabled', () => {
		tick();
		expect(x()).toBe('calc(-4px / var(--h-zoom))');
		action?.update?.({ enabled: true, paused: true });
		tick();
		expect(x()).toBe('calc(-4px / var(--h-zoom))');
		action?.update?.({ enabled: true, paused: false });
		tick();
		expect(x()).toBe('calc(1px / var(--h-zoom))');
		action?.update?.({ enabled: false, paused: false });
		expect(x()).toBe('');
		expect(vi.getTimerCount()).toBe(0);
	});

	it('holds through a long press and recent activity without jumping on release', () => {
		pointer('pointerdown');
		tick();
		tick();
		expect(x()).toBe('');
		vi.advanceTimersByTime(PIXEL_SHIFT_INTERVAL - 1000);
		pointer('pointerup');
		vi.advanceTimersByTime(1000);
		expect(x()).toBe('');
		tick();
		expect(x()).not.toBe('');
		const held = x();
		vi.advanceTimersByTime(PIXEL_SHIFT_INTERVAL - 1000);
		window.dispatchEvent(new KeyboardEvent('keydown'));
		vi.advanceTimersByTime(1000);
		expect(x()).toBe(held);
	});

	it('stops in hidden tabs and cleans up timers and styles on destroy', () => {
		const visible = vi.spyOn(document, 'visibilityState', 'get');
		visible.mockReturnValue('hidden');
		document.dispatchEvent(new Event('visibilitychange'));
		expect(vi.getTimerCount()).toBe(0);
		tick();
		expect(x()).toBe('');
		visible.mockReturnValue('visible');
		document.dispatchEvent(new Event('visibilitychange'));
		tick();
		expect(x()).not.toBe('');
		action?.destroy?.();
		action = undefined;
		expect(x()).toBe('');
		expect(vi.getTimerCount()).toBe(0);
	});
});
