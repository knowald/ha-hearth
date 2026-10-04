import { fireEvent, render, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { english as en } from '$lib/core/i18n/testing';
import { DEFAULT_HEARTH_CONFIG, takenCardIds, type HearthConfig } from '../config';
import {
	acceptUndoOffer,
	cancelEdit,
	confirmRequestedAction,
	currentRoom,
	dismissUndoOffer,
	editor,
	enterEditMode,
	hearthConfig,
	hearthEditMode,
	requestedConfirmation,
	undoOffer
} from '../store';
import CardColumns from '../CardColumns.svelte';
import Rail from '../Rail.svelte';
import CardEditSheet from './CardEditSheet.svelte';
import RailWidgetEditSheet from './RailWidgetEditSheet.svelte';
import RoomEditSheet from './RoomEditSheet.svelte';
import StackEditSheet from './StackEditSheet.svelte';

/* The sheets' layout actions: duplicate, move to a page, remove with an undo. */

function seed() {
	const config: HearthConfig = structuredClone(DEFAULT_HEARTH_CONFIG);
	config.rooms = [
		{
			id: 'den',
			name: 'Den',
			icon: 'sofa',
			cards: [
				[
					{
						id: 'lights',
						type: 'entities',
						title: 'Lights',
						entities: [{ entity: 'switch.fan' }]
					},
					{
						id: 'stack',
						kind: 'stack',
						direction: 'vertical',
						cards: [{ id: 'inner', type: 'entities', entities: [] }]
					}
				]
			] as never
		},
		{ id: 'kitchen', name: 'Kitchen', icon: 'kitchen', columns: 2, cards: [[], []] }
	];
	config.rail = [
		{ id: 'clock', type: 'clock' },
		{ id: 'status', type: 'status' }
	] as never;
	hearthConfig.set(config);
	enterEditMode();
}

const den = () => get(hearthConfig).rooms[0].cards[0];
const kitchen = () => get(hearthConfig).rooms[1].cards;

beforeEach(seed);

afterEach(() => {
	dismissUndoOffer();
	requestedConfirmation.set(null);
	editor.set(null);
	cancelEdit();
	currentRoom.set('home');
});

describe('the card sheet', () => {
	it('duplicates the card next to it and opens the copy', async () => {
		render(CardEditSheet, { roomId: 'den', id: 'lights' });
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_duplicate }));
		const ids = den().map((item) => item.id);
		expect(ids[0]).toBe('lights');
		expect(ids[2]).toBe('stack');
		expect(den()[1]).toMatchObject({ type: 'entities', title: 'Lights' });
		expect(new Set(takenCardIds(get(hearthConfig))).size).toBe(
			takenCardIds(get(hearthConfig)).length
		);
		expect(get(editor)).toEqual({ kind: 'card', roomId: 'den', id: ids[1] });
	});

	it('moves the card to another page and column on Done', async () => {
		render(CardEditSheet, { roomId: 'den', id: 'lights' });
		const page = screen.getByRole('combobox', { name: en.hearth_page });
		expect(screen.queryByRole('combobox', { name: en.hearth_column })).toBeNull();
		await fireEvent.change(page, { target: { value: 'kitchen' } });
		const column = screen.getByRole('combobox', { name: en.hearth_column });
		await fireEvent.change(column, { target: { value: '1' } });
		// staged: nothing moves before Done
		expect(den()[0].id).toBe('lights');
		await fireEvent.click(screen.getByRole('button', { name: en.done }));
		expect(den().map((item) => item.id)).toEqual(['stack']);
		expect(kitchen()[1].map((item) => item.id)).toEqual(['lights']);
	});

	it('removes at once and offers an undo instead of asking', async () => {
		render(CardEditSheet, { roomId: 'den', id: 'lights' });
		await fireEvent.click(screen.getByRole('button', { name: en.remove }));
		expect(get(requestedConfirmation)).toBeNull();
		expect(den().map((item) => item.id)).toEqual(['stack']);
		expect(get(undoOffer)).toMatchObject({ message: en.hearth_card_removed });
		acceptUndoOffer();
		expect(den().map((item) => item.id)).toEqual(['lights', 'stack']);
	});
});

describe('the stack sheet', () => {
	it('removes the stack with its cards once confirmed, and offers an undo', async () => {
		render(StackEditSheet, { roomId: 'den', column: 0, index: 1 });
		expect(screen.getByRole('button', { name: en.hearth_unwrap })).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_remove_stack_and_cards }));
		expect(get(requestedConfirmation)?.title).toBe(en.hearth_remove_stack_and_cards_title);
		expect(den()).toHaveLength(2);
		confirmRequestedAction();
		expect(den().map((item) => item.id)).toEqual(['lights']);
		expect(takenCardIds(get(hearthConfig))).not.toContain('inner');
		expect(get(undoOffer)).toMatchObject({ message: en.hearth_stack_removed });
		acceptUndoOffer();
		expect(takenCardIds(get(hearthConfig))).toContain('inner');
	});

	it('duplicates the stack with fresh ids for it and its cards', async () => {
		render(StackEditSheet, { roomId: 'den', column: 0, index: 1 });
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_duplicate }));
		const ids = takenCardIds(get(hearthConfig));
		expect(ids).toHaveLength(5);
		expect(new Set(ids).size).toBe(5);
		expect(get(editor)).toEqual({ kind: 'stack', roomId: 'den', column: 0, index: 2 });
	});
});

describe('the widget sheet', () => {
	it('duplicates the widget and opens the copy', async () => {
		render(RailWidgetEditSheet, { index: 0 });
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_duplicate }));
		expect(get(hearthConfig).rail.map((widget) => widget.id)).toEqual([
			'clock',
			'clock-2',
			'status'
		]);
		expect(get(editor)).toEqual({ kind: 'railWidget', index: 1 });
	});

	it('removes at once and offers an undo', async () => {
		render(RailWidgetEditSheet, { index: 1 });
		await fireEvent.click(screen.getByRole('button', { name: en.remove }));
		expect(get(requestedConfirmation)).toBeNull();
		expect(get(undoOffer)).toMatchObject({ message: en.hearth_widget_removed });
	});
});

describe('the page sheet', () => {
	it('duplicates the page, shows the copy and opens its editor', async () => {
		render(RoomEditSheet, { id: 'den' });
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_duplicate }));
		const rooms = get(hearthConfig).rooms;
		expect(rooms.map((room) => room.id)).toEqual(['den', 'den-copy', 'kitchen']);
		expect(rooms[1].name).toBe('Den copy');
		expect(get(currentRoom)).toBe('den-copy');
		expect(get(editor)).toEqual({ kind: 'room', id: 'den-copy' });
	});

	it('still asks before removing a whole page', async () => {
		render(RoomEditSheet, { id: 'den' });
		await fireEvent.click(screen.getByRole('button', { name: en.remove }));
		expect(get(requestedConfirmation)?.title).toBe(en.hearth_remove_confirm_title);
	});

	it('stages a page move until Done', async () => {
		render(RoomEditSheet, { id: 'den' });
		await fireEvent.click(screen.getByTitle(en.hearth_move_down));
		expect(get(hearthConfig).rooms[0].id).toBe('den');
		await fireEvent.click(screen.getByRole('button', { name: en.done }));
		expect(get(hearthConfig).rooms.map((room) => room.id)).toEqual(['kitchen', 'den']);
	});
});

describe('tapping in edit mode', () => {
	function renderColumns() {
		hearthEditMode.set(true);
		return render(CardColumns, {
			columns: get(hearthConfig).rooms[0].cards,
			locate: (config: HearthConfig) => config.rooms[0].cards,
			groupName: 'test',
			roomId: 'den'
		});
	}

	it('opens the editor of the card that was tapped', async () => {
		const { container } = renderColumns();
		// the card's own body, not the slot around it
		const body = container.querySelector('.card-slot[data-id="lights"]')!.lastElementChild!;
		await fireEvent.click(body);
		expect(get(editor)).toEqual({ kind: 'card', roomId: 'den', id: 'lights' });
	});

	it('opens the card from a focused tile with Enter', async () => {
		const { container } = renderColumns();
		const tile = container.querySelector<HTMLElement>(
			'.card-slot[data-id="lights"] .entity-slot [role="button"]'
		)!;
		expect(tile.tabIndex).toBe(0);
		await fireEvent.keyDown(tile, { key: 'Enter' });
		expect(get(editor)).toEqual({ kind: 'card', roomId: 'den', id: 'lights' });
	});

	it('opens a card inside a stack, and the stack from around its cards', async () => {
		const { container } = renderColumns();
		await fireEvent.click(container.querySelector('.card-slot[data-id="inner"]')!);
		expect(get(editor)).toEqual({ kind: 'card', roomId: 'den', id: 'inner' });
		await fireEvent.click(container.querySelector('.stack-slot')!);
		expect(get(editor)).toEqual({ kind: 'stack', roomId: 'den', column: 0, index: 1 });
	});

	it('leaves a press that started on a grip to the drag', async () => {
		const { container } = renderColumns();
		const grip = container.querySelector('.card-slot[data-id="lights"] .drag-handle')!;
		await fireEvent.pointerDown(grip, { isPrimary: true });
		await fireEvent.click(container.querySelector('.card-slot[data-id="lights"]')!);
		expect(get(editor)).toBeNull();
	});

	it('labels the stack chip and puts it after the stack title, clear of the cards', () => {
		const { container } = renderColumns();
		const chip = container.querySelector('.stack-slot .group-label .chip')!;
		expect(chip.classList.contains('after')).toBe(true);
		expect(chip.textContent).toContain(en.hearth_stack);
	});

	it('drops a stack whose last card is dragged out of it', () => {
		const { container } = renderColumns();
		container
			.querySelector('.column')!
			.dispatchEvent(new CustomEvent('dndreceive', { detail: { id: 'inner', newIndex: 0 } }));
		expect(den().map((item) => item.id)).toEqual(['inner', 'lights']);
	});

	it('does nothing outside edit mode', async () => {
		const { container } = renderColumns();
		hearthEditMode.set(false);
		await fireEvent.click(container.querySelector('.card-slot[data-id="lights"]')!);
		expect(get(editor)).toBeNull();
	});
});

describe('tapping a rail widget in edit mode', () => {
	beforeEach(() => {
		const config = get(hearthConfig);
		config.rail = [
			{ id: 'clock', type: 'clock' },
			{ id: 'nav', type: 'nav' }
		] as never;
		hearthConfig.set(config);
		hearthEditMode.set(true);
	});

	afterEach(() => hearthEditMode.set(false));

	it('opens the widget editor, but leaves the page list to pick pages', async () => {
		const { container } = render(Rail, { onsearch: () => {} });
		await fireEvent.click(container.querySelector('.widget[data-id="clock"]')!);
		expect(get(editor)).toEqual({ kind: 'railWidget', index: 0 });

		editor.set(null);
		await fireEvent.click(screen.getByRole('button', { name: /Kitchen/ }));
		expect(get(editor)).toBeNull();
		expect(get(currentRoom)).toBe('kitchen');
	});
});
