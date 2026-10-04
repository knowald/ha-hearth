import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActionReturn } from 'svelte/action';
import { editTap, TAP_SLOP } from './editTap';

function pointer(type: string, init: PointerEventInit = {}) {
	return new PointerEvent(type, { bubbles: true, isPrimary: true, ...init });
}

function click(x: number, y: number, detail = 1) {
	return new MouseEvent('click', {
		bubbles: true,
		cancelable: true,
		clientX: x,
		clientY: y,
		detail
	});
}

describe('editTap', () => {
	let container: HTMLElement;
	let card: HTMLElement;
	let grip: HTMLElement;
	let open: ReturnType<typeof vi.fn<(target: Element) => boolean>>;
	let action: ActionReturn<Parameters<typeof editTap>[1]>;

	beforeEach(() => {
		container = document.createElement('div');
		container.innerHTML = `
			<div class="card-slot">
				<div class="chip"><span class="drag-handle"></span></div>
				<div class="body"><div class="tile" role="button" tabindex="0"></div></div>
			</div>`;
		document.body.append(container);
		card = container.querySelector('.body')!;
		grip = container.querySelector('.drag-handle')!;
		open = vi.fn(() => true);
		action = editTap(container, { enabled: true, open }) as typeof action;
	});

	afterEach(() => {
		action.destroy?.();
		container.remove();
	});

	it('opens on a tap and keeps the click from the card underneath', () => {
		const below = vi.fn();
		document.body.addEventListener('click', below);
		card.dispatchEvent(pointer('pointerdown', { clientX: 5, clientY: 5 }));
		card.dispatchEvent(click(5 + TAP_SLOP, 5));
		document.body.removeEventListener('click', below);
		expect(open).toHaveBeenCalledWith(card);
		expect(below).not.toHaveBeenCalled();
	});

	it('takes a press that moved past the slop for a drag', () => {
		card.dispatchEvent(pointer('pointerdown', { clientX: 5, clientY: 5 }));
		card.dispatchEvent(click(5, 6 + TAP_SLOP));
		expect(open).not.toHaveBeenCalled();
	});

	it('leaves a press on the grip to the drag, wherever the click lands', () => {
		grip.dispatchEvent(pointer('pointerdown', { clientX: 5, clientY: 5 }));
		card.dispatchEvent(click(5, 5));
		expect(open).not.toHaveBeenCalled();
	});

	it('forgets a press the browser cancelled, such as a scroll', () => {
		card.dispatchEvent(pointer('pointerdown', { clientX: 5, clientY: 5 }));
		card.dispatchEvent(pointer('pointercancel'));
		// a later click far from that press is judged on its own
		card.dispatchEvent(click(200, 200));
		expect(open).toHaveBeenCalledOnce();
	});

	it('ignores a second finger', () => {
		card.dispatchEvent(pointer('pointerdown', { clientX: 5, clientY: 5 }));
		grip.dispatchEvent(pointer('pointerdown', { clientX: 300, clientY: 300, isPrimary: false }));
		card.dispatchEvent(click(5, 5));
		expect(open).toHaveBeenCalledOnce();
	});

	it('opens on a click from the keyboard, which has no pointer position', () => {
		card.dispatchEvent(pointer('pointerdown', { clientX: 5, clientY: 5 }));
		card.dispatchEvent(click(0, 300, 0));
		expect(open).toHaveBeenCalledOnce();
	});

	it('opens from Enter on a focused tile and stops the tile acting on it', () => {
		const tile = container.querySelector<HTMLElement>('.tile')!;
		const below = vi.fn();
		document.body.addEventListener('keydown', below);
		const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
		tile.dispatchEvent(event);
		document.body.removeEventListener('keydown', below);
		expect(open).toHaveBeenCalledWith(tile);
		expect(event.defaultPrevented).toBe(true);
		expect(below).not.toHaveBeenCalled();
	});

	it('lets the click through when nothing opened, and does nothing while disabled', () => {
		open.mockReturnValue(false);
		const below = vi.fn();
		document.body.addEventListener('click', below);
		card.dispatchEvent(click(5, 5));
		expect(below).toHaveBeenCalledOnce();
		action.update?.({ enabled: false, open });
		card.dispatchEvent(click(5, 5));
		document.body.removeEventListener('click', below);
		expect(open).toHaveBeenCalledOnce();
	});
});
