import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../static/translations/en.json';
import { DEFAULT_HEARTH_CONFIG, type HearthConfig } from '../config';
import { configDocument } from '../transfer';
import {
	confirmRequestedAction,
	dismissConfirmation,
	editor,
	hearthConfig,
	requestedConfirmation
} from '../store';
import AlertEditSheet from './AlertEditSheet.svelte';
import CardEditSheet from './CardEditSheet.svelte';
import CodeEditSheet from './CodeEditSheet.svelte';
import EditSheet from './EditSheet.svelte';
import RailWidgetEditSheet from './RailWidgetEditSheet.svelte';
import RoomEditSheet from './RoomEditSheet.svelte';
import StackEditSheet from './StackEditSheet.svelte';

const children = createRawSnippet(() => ({ render: () => '<div class="field"></div>' }));

function overlay() {
	return document.querySelector('.overlay') as HTMLElement;
}

async function tap(element: HTMLElement) {
	await fireEvent.pointerDown(element);
	await fireEvent.click(element);
}

function pressEscape() {
	window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
}

function close() {
	return fireEvent.click(screen.getByRole('button', { name: en.hearth_close }));
}

function expectDiscardPrompt() {
	expect(get(requestedConfirmation)).toMatchObject({
		title: en.hearth_discard_sheet_title,
		message: en.hearth_discard_sheet_message,
		confirmLabel: en.hearth_discard
	});
}

afterEach(() => {
	dismissConfirmation();
	editor.set(null);
	hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
});

describe('EditSheet with staged changes', () => {
	function renderSheet(dirty: boolean) {
		const onclose = vi.fn();
		const onback = vi.fn();
		render(EditSheet, { title: 'Edit', children, onclose, onback, ondone: vi.fn(), dirty });
		return { onclose, onback };
	}

	it('closes at once on a backdrop tap while clean', async () => {
		const { onclose } = renderSheet(false);
		await tap(overlay());
		expect(onclose).toHaveBeenCalledOnce();
		expect(get(requestedConfirmation)).toBeNull();
	});

	it('asks before a backdrop tap, the close button, Escape or back drop the changes', async () => {
		const { onclose, onback } = renderSheet(true);
		await tap(overlay());
		expectDiscardPrompt();
		dismissConfirmation();
		await close();
		expectDiscardPrompt();
		dismissConfirmation();
		pressEscape();
		expectDiscardPrompt();
		dismissConfirmation();
		await fireEvent.click(screen.getByRole('button', { name: en.back }));
		expectDiscardPrompt();
		expect(onclose).not.toHaveBeenCalled();
		confirmRequestedAction();
		expect(onback).toHaveBeenCalledOnce();
	});

	it('closes on the click, not the press, so the click cannot land under the finger', async () => {
		const { onclose } = renderSheet(false);
		await fireEvent.pointerDown(overlay());
		expect(onclose).not.toHaveBeenCalled();
		await fireEvent.click(overlay());
		expect(onclose).toHaveBeenCalledOnce();
	});

	it('stays open when a press inside the sheet is released over the backdrop', async () => {
		const { onclose } = renderSheet(false);
		await fireEvent.pointerDown(document.querySelector('.field') as HTMLElement);
		// the click goes to the nearest common ancestor, which is the backdrop
		await fireEvent.click(overlay());
		expect(onclose).not.toHaveBeenCalled();
	});

	it('labels the move buttons for assistive technology, not only by tooltip', () => {
		render(EditSheet, {
			title: 'Edit',
			children,
			onclose: vi.fn(),
			ondone: vi.fn(),
			onmoveup: vi.fn(),
			onmovedown: vi.fn()
		});
		expect(screen.getByRole('button', { name: en.hearth_move_up }).getAttribute('aria-label')).toBe(
			en.hearth_move_up
		);
		expect(
			screen.getByRole('button', { name: en.hearth_move_down }).getAttribute('aria-label')
		).toBe(en.hearth_move_down);
	});
});

function seed() {
	const config: HearthConfig = structuredClone(DEFAULT_HEARTH_CONFIG);
	config.rooms = [
		{
			id: 'den',
			name: 'Den',
			icon: 'sofa',
			cards: [
				[
					{ id: 'lights', type: 'entities', title: 'Lights', entities: [] },
					{ id: 'group', kind: 'stack', direction: 'horizontal', cards: [] }
				] as never
			]
		}
	];
	config.rail = [{ id: 'clock', type: 'clock' }] as never;
	config.alerts = [
		{
			id: 'fridge',
			title: 'Fridge door open',
			severity: 'warning',
			conditions: [{ entity: 'binary_sensor.fridge_door', state: 'on' }]
		}
	];
	hearthConfig.set(config);
}

describe('item sheets', () => {
	beforeEach(seed);

	it('closes an untouched card at once and asks once a field changed', async () => {
		editor.set({ kind: 'card', roomId: 'den', id: 'lights' });
		render(CardEditSheet, { roomId: 'den', id: 'lights' });
		const title = await screen.findByLabelText(en.hearth_title);
		await close();
		expect(get(requestedConfirmation)).toBeNull();
		expect(get(editor)).toBeNull();

		editor.set({ kind: 'card', roomId: 'den', id: 'lights' });
		await fireEvent.input(title, { target: { value: 'Lamps' } });
		await close();
		expectDiscardPrompt();
		expect(get(editor)).not.toBeNull();
		confirmRequestedAction();
		expect(get(editor)).toBeNull();
		expect(get(hearthConfig).rooms[0].cards?.[0][0]).toMatchObject({ title: 'Lights' });
	});

	it('counts a card back at its starting values as untouched', async () => {
		render(CardEditSheet, { roomId: 'den', id: 'lights' });
		const title = await screen.findByLabelText(en.hearth_title);
		await fireEvent.input(title, { target: { value: 'Lamps' } });
		await fireEvent.input(title, { target: { value: 'Lights' } });
		pressEscape();
		expect(get(requestedConfirmation)).toBeNull();
	});

	it('asks before a widget edit is dropped', async () => {
		render(RailWidgetEditSheet, { index: 0 });
		await waitFor(() => expect(screen.getByRole('button', { name: en.done })).toBeTruthy());
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_hide_on_mobile }));
		pressEscape();
		expectDiscardPrompt();
	});

	it('asks before a page edit is dropped', async () => {
		render(RoomEditSheet, { id: 'den' });
		await close();
		expect(get(requestedConfirmation)).toBeNull();
		await fireEvent.input(screen.getByLabelText(en.name), { target: { value: 'Office' } });
		await close();
		expectDiscardPrompt();
	});

	it('asks before a stack edit is dropped', async () => {
		render(StackEditSheet, { roomId: 'den', column: 0, index: 1 });
		await fireEvent.input(screen.getByLabelText(en.hearth_title_optional), {
			target: { value: 'Media' }
		});
		await tap(overlay());
		expectDiscardPrompt();
	});

	it('asks before an alert edit is dropped, from back as well as close', async () => {
		editor.set({ kind: 'alert', index: 0 });
		render(AlertEditSheet, { index: 0 });
		await fireEvent.click(screen.getByRole('button', { name: en.back }));
		expect(get(requestedConfirmation)).toBeNull();
		expect(get(editor)).toEqual({ kind: 'settings' });

		editor.set({ kind: 'alert', index: 0 });
		await fireEvent.input(screen.getByLabelText(en.hearth_title), {
			target: { value: 'Fridge still open' }
		});
		await fireEvent.click(screen.getByRole('button', { name: en.back }));
		expectDiscardPrompt();
		expect(get(editor)).toEqual({ kind: 'alert', index: 0 });
		dismissConfirmation();
		await close();
		expectDiscardPrompt();
		confirmRequestedAction();
		expect(get(editor)).toBeNull();
		expect(get(hearthConfig).alerts?.[0].title).toBe('Fridge door open');
	});
});

describe('CodeEditSheet', () => {
	beforeEach(seed);

	it('closes at once while the document matches the live configuration', async () => {
		editor.set({ kind: 'code' });
		render(CodeEditSheet, { draft: configDocument(get(hearthConfig)) });
		pressEscape();
		expect(get(requestedConfirmation)).toBeNull();
		expect(get(editor)).toBeNull();
	});

	it('asks before an unapplied document is dropped', async () => {
		editor.set({ kind: 'code' });
		render(CodeEditSheet, { draft: 'rooms: []\n' });
		await close();
		expectDiscardPrompt();
		expect(get(editor)).toEqual({ kind: 'code' });
	});
});
