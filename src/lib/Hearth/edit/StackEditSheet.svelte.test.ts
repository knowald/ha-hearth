import { fireEvent, render, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_HEARTH_CONFIG, type HearthConfig } from '../config';
import en from '../../../../static/translations/en.json';
import { editor, hearthConfig, hearthEditMode, requestedConfirmation } from '../store';
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

describe('editing a stack', () => {
	beforeEach(() => {
		seed();
		const config = get(hearthConfig);
		config.rooms[0].cards[0].push({ id: 'first', type: 'entities', entities: [] } as never, {
			id: 'stack',
			kind: 'stack',
			direction: 'vertical',
			fill: 0,
			cards: [{ id: 'inner', type: 'entities', entities: [] } as never]
		});
		hearthConfig.set(config);
	});

	afterEach(() => {
		editor.set(null);
		requestedConfirmation.set(null);
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
	});

	it('unwraps at once, as the non-destructive action it is', async () => {
		render(StackEditSheet, { roomId: 'den', column: 0, index: 1 });
		const unwrap = screen.getByRole('button', { name: 'Unwrap' });
		expect(unwrap.classList.contains('danger')).toBe(false);
		await fireEvent.click(unwrap);
		expect(get(requestedConfirmation)).toBeNull();
		expect(denColumn().map((item) => item.id)).toEqual(['first', 'inner']);
	});

	it('offers the same fill choices as a card and keeps an explicit none', () => {
		render(StackEditSheet, { roomId: 'den', column: 0, index: 1 });
		const select = screen.getByRole('combobox', {
			name: en.hearth_fill_leftover_height
		}) as HTMLSelectElement;
		expect([...select.options].map((option) => option.value)).toEqual(['', '0', '1', '2', '3']);
		expect(select.options[0].textContent).toBe(en.hearth_fill_default_stack);
		expect(select.value).toBe('0');
	});

	it('moves up from the header and still saves the moved stack', async () => {
		render(StackEditSheet, { roomId: 'den', column: 0, index: 1 });
		await fireEvent.click(screen.getByTitle(en.hearth_move_up));
		expect(denColumn().map((item) => item.id)).toEqual(['stack', 'first']);
		await fireEvent.input(screen.getByRole('textbox', { name: en.hearth_title_optional }), {
			target: { value: 'Lights' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Done' }));
		expect(denColumn()[0]).toMatchObject({ id: 'stack', title: 'Lights' });
		expect(denColumn()[1]).not.toHaveProperty('title');
	});
});
