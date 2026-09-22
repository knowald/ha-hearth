import { fireEvent, render, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { translation } from '$lib/core/i18n';
import { hassEntity } from '$lib/core/ha/testing';
import BlindTile from './BlindTile.svelte';

vi.mock('$lib/core/domains/cover', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/core/domains/cover')>()),
	toggleBlind: vi.fn(),
	setBlindPosition: vi.fn()
}));
import { setBlindPosition, toggleBlind } from '$lib/core/domains/cover';
import { confirmRequestedAction, dismissConfirmation, popup, requestedConfirmation } from './store';

function pointer(type: string, clientX: number) {
	const event = new Event(type) as PointerEvent;
	Object.defineProperties(event, {
		clientX: { value: clientX },
		pointerId: { value: 1 }
	});
	return event;
}

// the tile spans x 0-200, so clientX / 2 is the percentage under the finger
function tile() {
	const node = screen.getByRole('button');
	node.getBoundingClientRect = () => ({ left: 0, width: 200 }) as DOMRect;
	return node;
}

function tap(node: HTMLElement) {
	node.dispatchEvent(pointer('pointerdown', 20));
	node.dispatchEvent(pointer('pointerup', 20));
}

function drag(node: HTMLElement, toX: number) {
	node.dispatchEvent(pointer('pointerdown', 20));
	node.dispatchEvent(pointer('pointermove', toX));
	node.dispatchEvent(pointer('pointerup', toX));
}

describe('BlindTile', () => {
	beforeEach(() => {
		vi.mocked(toggleBlind).mockClear();
		vi.mocked(setBlindPosition).mockClear();
		dismissConfirmation();
	});

	it('asks in the active language before opening a garage door', async () => {
		states.set({
			'cover.garage': hassEntity('cover.garage', 'closed', {
				device_class: 'garage',
				current_position: 0
			})
		});
		const english = get(translation);
		translation.set({
			...english,
			hearth_open_cover_question: '{label} ouvrir ?',
			hearth_open: 'Ouvrir'
		});
		render(BlindTile, { entity: 'cover.garage', name: 'Garage' });
		tap(tile());
		translation.set(english);
		expect(toggleBlind).not.toHaveBeenCalled();
		expect(get(requestedConfirmation)).toMatchObject({
			title: 'Garage ouvrir ?',
			confirmLabel: 'Ouvrir'
		});
		confirmRequestedAction();
		expect(toggleBlind).toHaveBeenCalledWith('cover.garage');
	});

	it('toggles an ordinary blind without asking', async () => {
		states.set({ 'cover.blind': hassEntity('cover.blind', 'open', { current_position: 100 }) });
		render(BlindTile, { entity: 'cover.blind' });
		tap(tile());
		expect(get(requestedConfirmation)).toBeNull();
		expect(toggleBlind).toHaveBeenCalledWith('cover.blind');
	});

	it('still accepts commands while the cover reports unknown', async () => {
		states.set({ 'cover.blind': hassEntity('cover.blind', 'unknown') });
		render(BlindTile, { entity: 'cover.blind' });
		const node = tile();
		expect(node.classList.contains('unreachable')).toBe(false);
		tap(node);
		expect(toggleBlind).toHaveBeenCalledWith('cover.blind');
	});

	it('sets the position with a horizontal swipe, like a light tile sets brightness', () => {
		states.set({ 'cover.blind': hassEntity('cover.blind', 'closed', { current_position: 0 }) });
		render(BlindTile, { entity: 'cover.blind' });
		drag(tile(), 120);
		expect(toggleBlind).not.toHaveBeenCalled();
		expect(setBlindPosition).toHaveBeenLastCalledWith('cover.blind', 60);
	});

	it('asks once on release before a swipe moves a garage door', () => {
		states.set({
			'cover.garage': hassEntity('cover.garage', 'closed', {
				device_class: 'garage',
				current_position: 0
			})
		});
		render(BlindTile, { entity: 'cover.garage', name: 'Garage' });
		drag(tile(), 120);
		// the preview moves, the command waits for the answer
		expect(setBlindPosition).toHaveBeenCalledWith('cover.garage', 60, false);
		expect(setBlindPosition).not.toHaveBeenCalledWith('cover.garage', 60);
		expect(get(requestedConfirmation)?.confirmLabel).toBe('Open');
		confirmRequestedAction();
		expect(setBlindPosition).toHaveBeenLastCalledWith('cover.garage', 60);
	});

	it('opens the cover sheet with the configured icon on a long press from the keyboard', async () => {
		states.set({ 'cover.blind': hassEntity('cover.blind', 'open', { current_position: 100 }) });
		render(BlindTile, { entity: 'cover.blind', icon: 'curtains' });
		await fireEvent.keyDown(tile(), { key: 'Enter', shiftKey: true });
		expect(get(popup)).toMatchObject({ kind: 'blind', icon: 'curtains' });
		popup.set(null);
	});
});
