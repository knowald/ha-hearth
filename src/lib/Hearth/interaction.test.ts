import { afterEach, describe, expect, it, vi } from 'vitest';
import { HOLD_MS, longPress } from './interaction';

function pointer(type: string, clientX: number, clientY = 0, isPrimary = true) {
	const event = new Event(type) as PointerEvent;
	Object.defineProperties(event, {
		clientX: { value: clientX },
		clientY: { value: clientY },
		pointerId: { value: 1 },
		isPrimary: { value: isPrimary }
	});
	return event;
}

describe('longPress', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('holds after 500ms without movement', () => {
		vi.useFakeTimers();
		const node = new EventTarget();
		const hold = vi.fn();
		longPress(node as unknown as HTMLElement, { hold });

		node.dispatchEvent(pointer('pointerdown', 20));
		vi.advanceTimersByTime(500);
		expect(hold).toHaveBeenCalledOnce();
	});

	it('ignores non-primary pointers', () => {
		vi.useFakeTimers();
		const node = new EventTarget();
		const hold = vi.fn();
		longPress(node as unknown as HTMLElement, { hold });

		node.dispatchEvent(pointer('pointerdown', 20, 0, false));
		vi.advanceTimersByTime(600);
		expect(hold).not.toHaveBeenCalled();
	});

	it('replaces the pending timer on a repeated pointerdown, so a cancel stops it', () => {
		vi.useFakeTimers();
		const node = new EventTarget();
		const hold = vi.fn();
		longPress(node as unknown as HTMLElement, { hold });

		node.dispatchEvent(pointer('pointerdown', 20));
		vi.advanceTimersByTime(200);
		node.dispatchEvent(pointer('pointerdown', 20));
		node.dispatchEvent(pointer('pointerup', 20));
		vi.advanceTimersByTime(600);
		expect(hold).not.toHaveBeenCalled();
	});
});

describe('longPress deferOnTouch', () => {
	afterEach(() => vi.useRealTimers());

	function touch(type: string) {
		const event = pointer(type, 20);
		Object.defineProperty(event, 'pointerType', { value: 'touch' });
		return event;
	}

	it('runs a touch hold at the release, so it counts as user activation', () => {
		vi.useFakeTimers();
		const node = new EventTarget();
		const hold = vi.fn();
		longPress(node as unknown as HTMLElement, { hold, deferOnTouch: true });

		node.dispatchEvent(touch('pointerdown'));
		vi.advanceTimersByTime(HOLD_MS);
		expect(hold).not.toHaveBeenCalled();
		node.dispatchEvent(touch('pointerup'));
		expect(hold).toHaveBeenCalledOnce();
	});

	it('runs nothing for a touch released early or cancelled after the threshold', () => {
		vi.useFakeTimers();
		const node = new EventTarget();
		const hold = vi.fn();
		longPress(node as unknown as HTMLElement, { hold, deferOnTouch: true });

		node.dispatchEvent(touch('pointerdown'));
		vi.advanceTimersByTime(HOLD_MS - 1);
		node.dispatchEvent(touch('pointerup'));
		node.dispatchEvent(touch('pointerdown'));
		vi.advanceTimersByTime(HOLD_MS);
		node.dispatchEvent(touch('pointercancel'));
		node.dispatchEvent(touch('pointerup'));
		expect(hold).not.toHaveBeenCalled();
	});

	it('keeps mouse holds at the threshold', () => {
		vi.useFakeTimers();
		const node = new EventTarget();
		const hold = vi.fn();
		longPress(node as unknown as HTMLElement, { hold, deferOnTouch: true });

		node.dispatchEvent(pointer('pointerdown', 20));
		vi.advanceTimersByTime(HOLD_MS);
		expect(hold).toHaveBeenCalledOnce();
	});
});
