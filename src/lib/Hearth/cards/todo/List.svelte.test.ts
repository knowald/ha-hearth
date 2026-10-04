import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { get, writable } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Connection } from 'home-assistant-js-websocket';
import { connection } from '$lib/core/ha/connection';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import type { TodoItem, TodoList, TodoListStatus } from '$lib/core/domains/todo';

const items = writable<TodoItem[] | null>(null);
const status = writable<TodoListStatus>('ready');
const list = {
	items,
	status,
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

function withFeatures(features: number, state = '1') {
	states.set({
		'todo.shopping': hassEntity('todo.shopping', state, {
			friendly_name: 'Shopping',
			supported_features: features
		})
	});
}

function entry(uid: string, summary: string, extra: Partial<TodoItem> = {}): TodoItem {
	return { key: `uid:${uid}`, target: uid, summary, status: 'needs_action', ...extra };
}

describe('to-do list', () => {
	beforeEach(() => {
		connection.set({} as Connection);
		status.set('ready');
		items.set([
			entry('a', 'Milk', { due: '2020-01-01' }),
			entry('d', 'Tea'),
			entry('b', 'Eggs', { status: 'completed' })
		]);
		vi.mocked(createTodoList).mockClear();
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
		expect(createTodoList).toHaveBeenCalledWith('todo.shopping', expect.any(Object));
		unmount();
		expect(list.destroy).toHaveBeenCalled();
	});

	it('keeps its subscription when other card options change', async () => {
		withFeatures(ALL_FEATURES);
		const { rerender } = render(List, { card });
		await rerender({ card: { ...card, title: 'Groceries', sort: 'alphabetical' } });
		// a state update that leaves the list reachable does not resubscribe either
		withFeatures(ALL_FEATURES, '2');
		await Promise.resolve();
		expect(createTodoList).toHaveBeenCalledTimes(1);
		expect(list.destroy).not.toHaveBeenCalled();
	});

	it('shows a missing or unavailable list as unavailable without opening it', () => {
		states.set({});
		const { unmount } = render(List, { card });
		expect(screen.getByText('List unavailable')).toBeTruthy();
		expect(screen.queryByRole('textbox')).toBeNull();
		expect(createTodoList).not.toHaveBeenCalled();
		unmount();
		withFeatures(ALL_FEATURES, 'unavailable');
		render(List, { card });
		expect(screen.getByText('List unavailable')).toBeTruthy();
		expect(createTodoList).not.toHaveBeenCalled();
	});

	it('shows a list Home Assistant refuses as unavailable', () => {
		withFeatures(ALL_FEATURES);
		status.set('unavailable');
		render(List, { card });
		expect(screen.getByText('List unavailable')).toBeTruthy();
		expect(screen.queryByRole('textbox', { name: 'Add an item' })).toBeNull();
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
		expect(list.setStatus).toHaveBeenCalledWith('uid:a', 'completed');
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

	it('offers Clear completed while the section is folded', async () => {
		withFeatures(ALL_FEATURES);
		render(List, { card });
		await fireEvent.click(screen.getByRole('button', { name: 'Clear completed' }));
		confirmRequestedAction();
		expect(list.removeCompleted).toHaveBeenCalled();
	});

	it('removes an item after confirmation and moves focus to the next one', async () => {
		withFeatures(ALL_FEATURES);
		render(List, { card });
		await fireEvent.keyDown(screen.getByRole('button', { name: 'Milk' }), { key: 'Delete' });
		expect(get(requestedConfirmation)?.message).toBe('Remove "Milk" from the list?');
		expect(list.remove).not.toHaveBeenCalled();
		confirmRequestedAction();
		expect(list.remove).toHaveBeenCalledWith('uid:a');
		await waitFor(() =>
			expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Tea' }))
		);
	});

	it('moves focus to the add field after removing the last item', async () => {
		withFeatures(ALL_FEATURES);
		items.set([entry('a', 'Milk')]);
		render(List, { card });
		await fireEvent.keyDown(screen.getByRole('button', { name: 'Milk' }), { key: 'Delete' });
		confirmRequestedAction();
		items.set([]);
		await waitFor(() =>
			expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Add an item' }))
		);
	});

	it('renames an item in place and hands focus back to it', async () => {
		withFeatures(ALL_FEATURES);
		render(List, { card });
		await fireEvent.click(screen.getByRole('button', { name: 'Milk' }));
		const field = screen.getByRole('textbox', { name: 'Rename Milk' });
		await fireEvent.input(field, { target: { value: 'Oat milk' } });
		await fireEvent.keyDown(field, { key: 'Enter' });
		expect(list.rename).toHaveBeenCalledWith('uid:a', 'Oat milk');
		await waitFor(() =>
			expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Milk' }))
		);
	});

	it('cancels a rename with Escape and hands focus back', async () => {
		withFeatures(ALL_FEATURES);
		render(List, { card });
		await fireEvent.click(screen.getByRole('button', { name: 'Tea' }));
		await fireEvent.keyDown(screen.getByRole('textbox', { name: 'Rename Tea' }), {
			key: 'Escape'
		});
		expect(list.rename).not.toHaveBeenCalled();
		await waitFor(() =>
			expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Tea' }))
		);
	});

	it('announces a change that was rolled back', async () => {
		withFeatures(ALL_FEATURES);
		render(List, { card });
		const { onRollback } = vi.mocked(createTodoList).mock.calls[0][1]!;
		onRollback?.('Milk');
		await waitFor(() =>
			expect(screen.getByRole('status').textContent).toBe(
				'Could not save the change to "Milk", so it was undone'
			)
		);
	});

	it('offers only what the list supports', async () => {
		withFeatures(0);
		render(List, { card });
		expect(screen.queryByRole('textbox', { name: 'Add an item' })).toBeNull();
		expect(screen.getByRole('checkbox', { name: 'Milk' }).hasAttribute('disabled')).toBe(true);
		// neither rename nor delete: the text is not a control
		expect(screen.queryByRole('button', { name: 'Milk' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Clear completed' })).toBeNull();
	});

	it('makes an item it cannot name read-only', () => {
		withFeatures(ALL_FEATURES);
		items.set([{ key: 'summary:0:Tea', summary: 'Tea', status: 'needs_action' }]);
		render(List, { card });
		expect(screen.getByRole('checkbox', { name: 'Tea' }).hasAttribute('disabled')).toBe(true);
		expect(screen.queryByRole('button', { name: 'Tea' })).toBeNull();
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
