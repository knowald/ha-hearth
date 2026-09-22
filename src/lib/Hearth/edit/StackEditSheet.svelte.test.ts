import { fireEvent, render, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_HEARTH_CONFIG, type HearthConfig } from '../config';
import { editor, hearthConfig, hearthEditMode } from '../store';
import CardColumns from '../CardColumns.svelte';
import StackEditSheet from './StackEditSheet.svelte';

function seed() {
	const config: HearthConfig = structuredClone(DEFAULT_HEARTH_CONFIG);
	config.rooms = [{ id: 'den', name: 'Den', icon: 'sofa', cards: [[]] }];
	hearthConfig.set(config);
}

function denColumn() {
	return get(hearthConfig).rooms.find((room) => room.id === 'den')!.cards[0];
}

describe('adding a stack', () => {
	beforeEach(seed);

	afterEach(() => {
		editor.set(null);
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
	});

	it('opens the sheet without writing a stack yet', async () => {
		hearthEditMode.set(true);
		try {
			render(CardColumns, {
				columns: [[]],
				locate: (config: HearthConfig) => config.rooms[0].cards,
				groupName: 'test',
				roomId: 'den'
			});
			await fireEvent.click(screen.getByRole('button', { name: /Add stack/ }));
		} finally {
			hearthEditMode.set(false);
		}
		expect(get(editor)).toEqual({ kind: 'stack', roomId: 'den', column: 0, index: null });
		expect(denColumn()).toEqual([]);
	});

	it('leaves no empty stack behind when cancelled', async () => {
		render(StackEditSheet, { roomId: 'den', column: 0, index: null });
		expect(screen.getByRole('dialog', { name: 'Add stack' })).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Unwrap' })).toBeNull();
		await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
		expect(denColumn()).toEqual([]);
	});

	it('appends the stack on Done', async () => {
		render(StackEditSheet, { roomId: 'den', column: 0, index: null });
		await fireEvent.click(screen.getByRole('button', { name: 'Done' }));
		expect(denColumn()).toEqual([
			expect.objectContaining({ kind: 'stack', direction: 'horizontal', cards: [] })
		]);
	});

	it('keeps the edit title and unwrap for an existing stack', () => {
		const config = get(hearthConfig);
		config.rooms[0].cards[0].push({ id: 'stack', kind: 'stack', direction: 'vertical', cards: [] });
		hearthConfig.set(config);
		render(StackEditSheet, { roomId: 'den', column: 0, index: 0 });
		expect(screen.getByRole('dialog', { name: 'Edit stack' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Unwrap' })).toBeTruthy();
	});
});
