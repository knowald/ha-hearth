import { fireEvent, render, screen } from '@testing-library/svelte';
import { get, writable } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Connection } from 'home-assistant-js-websocket';
import { connection } from '$lib/core/ha/connection';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import type { TodoItem, TodoList } from '$lib/core/domains/todo';

const items = writable<TodoItem[] | null>(null);
const list = {
	items,
	add: vi.fn(),
	setStatus: vi.fn(),
	rename: vi.fn(),
	remove: vi.fn(),
	removeCompleted: vi.fn(),
	destroy: vi.fn()
} satisfies TodoList;

vi.mock('$lib/core/domains/todo', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/core/domains/todo')>()),
	createTodoList: vi.fn(() => list)
}));
import { createTodoList } from '$lib/core/domains/todo';
import {
	confirmRequestedAction,
	dismissConfirmation,
	hearthEditMode,
	requestedConfirmation
} from '../../store';
import List from './List.svelte';

const ALL_FEATURES = 1 | 2 | 4;
const card = { id: 'list', type: 'todo' as const, entity: 'todo.shopping' };

function withFeatures(features: number) {
	states.set({
		'todo.shopping': hassEntity('todo.shopping', '1', {
			friendly_name: 'Shopping',
			supported_features: features
		})
	});
}

describe('to-do list', () => {
	beforeEach(() => {
		connection.set({} as Connection);
		items.set([
			{ uid: 'a', summary: 'Milk', status: 'needs_action', due: '2020-01-01' },
			{ uid: 'b', summary: 'Eggs', status: 'completed' }
		]);
		for (const method of Object.values(list)) if (typeof method === 'function') method.mockClear();
		dismissConfirmation();
	});

	afterEach(() => {
		connection.set(undefined);
		hearthEditMode.set(false);
	});

	it('opens the list for the card entity and closes it on teardown', () => {
		withFeatures(ALL_FEATURES);
		const { unmount } = render(List, { card });
		expect(createTodoList).toHaveBeenCalledWith('todo.shopping');
		unmount();
		expect(list.destroy).toHaveBeenCalled();
	});

	it('adds an item on Enter and clears the field', async () => {
		withFeatures(ALL_FEATURES);
		render(List, { card });
		const field = screen.getByRole('textbox', { name: 'Add an item' });
		await fireEvent.input(field, { target: { value: 'Bread' } });
		await fireEvent.submit(field.closest('form')!);
		expect(list.add).toHaveBeenCalledWith('Bread');
		expect((field as HTMLInputElement).value).toBe('');
	});

	it('ticks an item off', async () => {
		withFeatures(ALL_FEATURES);
		render(List, { card });
		await fireEvent.click(screen.getByRole('checkbox', { name: 'Milk' }));
		expect(list.setStatus).toHaveBeenCalledWith('a', 'completed');
	});

	it('keeps completed items in a collapsed section unless show_completed is set', async () => {
		withFeatures(ALL_FEATURES);
		render(List, { card });
		const toggle = screen.getByRole('button', { name: /Completed \(1\)/ });
		expect(toggle.getAttribute('aria-expanded')).toBe('false');
		expect(screen.queryByRole('checkbox', { name: 'Eggs' })).toBeNull();
		await fireEvent.click(toggle);
		expect(screen.getByRole('checkbox', { name: 'Eggs' })).toBeTruthy();
	});

	it('shows completed items at once with show_completed', () => {
		withFeatures(ALL_FEATURES);
		render(List, { card: { ...card, show_completed: true } });
		expect(screen.getByRole('checkbox', { name: 'Eggs' }).getAttribute('aria-checked')).toBe(
			'true'
		);
	});

	it('removes an item after confirmation from the keyboard', async () => {
		withFeatures(ALL_FEATURES);
		render(List, { card });
		await fireEvent.keyDown(screen.getByRole('button', { name: 'Milk' }), { key: 'Delete' });
		expect(get(requestedConfirmation)?.message).toBe('Remove "Milk" from the list?');
		expect(list.remove).not.toHaveBeenCalled();
		confirmRequestedAction();
		expect(list.remove).toHaveBeenCalledWith('a');
	});

	it('renames an item in place', async () => {
		withFeatures(ALL_FEATURES);
		render(List, { card });
		await fireEvent.click(screen.getByRole('button', { name: 'Milk' }));
		const field = screen.getByRole('textbox', { name: 'Rename Milk' });
		await fireEvent.input(field, { target: { value: 'Oat milk' } });
		await fireEvent.keyDown(field, { key: 'Enter' });
		expect(list.rename).toHaveBeenCalledWith('a', 'Oat milk');
	});

	it('offers only what the list supports', async () => {
		withFeatures(0);
		render(List, { card });
		expect(screen.queryByRole('textbox', { name: 'Add an item' })).toBeNull();
		expect(screen.getByRole('checkbox', { name: 'Milk' }).hasAttribute('disabled')).toBe(true);
		// neither rename nor delete: the text is not a control
		expect(screen.queryByRole('button', { name: 'Milk' })).toBeNull();
		await fireEvent.click(screen.getByRole('button', { name: /Completed/ }));
		expect(screen.queryByRole('button', { name: 'Clear completed' })).toBeNull();
	});

	it('hides the add field with hide_add', () => {
		withFeatures(ALL_FEATURES);
		render(List, { card: { ...card, hide_add: true } });
		expect(screen.queryByRole('textbox', { name: 'Add an item' })).toBeNull();
	});

	it('marks a past due date as overdue', () => {
		withFeatures(ALL_FEATURES);
		const { container } = render(List, { card });
		const due = container.querySelector('.due');
		expect(due?.classList.contains('overdue')).toBe(true);
	});

	it('goes inert in edit mode so taps reach the card slot', () => {
		withFeatures(ALL_FEATURES);
		hearthEditMode.set(true);
		const { container } = render(List, { card });
		// jsdom has no inert attribute reflection, so read the property Svelte sets
		expect((container.querySelector('.body') as HTMLElement & { inert: boolean }).inert).toBe(true);
	});
});
