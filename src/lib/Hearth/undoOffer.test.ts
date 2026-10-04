import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_HEARTH_CONFIG } from './config';
import {
	acceptUndoOffer,
	cancelEdit,
	dismissUndoOffer,
	editor,
	enterEditMode,
	hearthConfig,
	offerUndo,
	pauseUndoOffer,
	resumeUndoOffer,
	undoOffer,
	UNDO_OFFER_MS,
	updateConfig
} from './store';

const names = () => get(hearthConfig).rooms.map((room) => room.name);

describe('the undo offer after a removal', () => {
	beforeEach(() => {
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
		enterEditMode();
		updateConfig((config) => {
			config.rooms[0].name = 'Removed';
		});
		offerUndo('Card removed');
	});

	afterEach(() => {
		vi.useRealTimers();
		dismissUndoOffer();
		cancelEdit();
	});

	it('takes the removal back', () => {
		expect(get(undoOffer)).toMatchObject({ message: 'Card removed' });
		acceptUndoOffer();
		expect(names()).toEqual(['Home']);
		expect(get(undoOffer)).toBeNull();
	});

	it('ends with the next change, so it never undoes that change instead', () => {
		updateConfig((config) => {
			config.rooms[0].icon = 'sofa';
		});
		expect(get(undoOffer)).toBeNull();
		acceptUndoOffer();
		expect(get(hearthConfig).rooms[0]).toMatchObject({ name: 'Removed', icon: 'sofa' });
	});

	it('goes away on its own', () => {
		vi.useFakeTimers();
		offerUndo('Card removed');
		vi.advanceTimersByTime(UNDO_OFFER_MS);
		expect(get(undoOffer)).toBeNull();
	});

	it('holds while the toast has the pointer or focus, then gets its full time again', () => {
		vi.useFakeTimers();
		offerUndo('Card removed');
		pauseUndoOffer();
		vi.advanceTimersByTime(UNDO_OFFER_MS * 2);
		expect(get(undoOffer)).not.toBeNull();
		resumeUndoOffer();
		vi.advanceTimersByTime(UNDO_OFFER_MS - 1);
		expect(get(undoOffer)).not.toBeNull();
		vi.advanceTimersByTime(1);
		expect(get(undoOffer)).toBeNull();
	});

	it('tells repeated offers apart so each is announced', () => {
		const first = get(undoOffer)!.serial;
		offerUndo('Card removed');
		expect(get(undoOffer)!.serial).not.toBe(first);
	});

	it('ends when another editor opens', () => {
		editor.set({ kind: 'settings' });
		expect(get(undoOffer)).toBeNull();
		editor.set(null);
	});

	it('ends with the edit session', () => {
		cancelEdit();
		expect(get(undoOffer)).toBeNull();
	});
});
