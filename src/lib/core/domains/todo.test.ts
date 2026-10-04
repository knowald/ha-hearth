import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Connection } from 'home-assistant-js-websocket';
import { connection } from '../ha/connection';
import { states } from '../ha/entities';
import { hassEntity } from '../ha/testing';
import {
	createTodoList,
	homeAssistantTodoSource,
	parseTodoItems,
	sortTodoItems,
	todoAbilities,
	todoDue,
	type TodoItem,
	type TodoSource
} from './todo';

const milk: TodoItem = { uid: 'a', summary: 'Milk', status: 'needs_action' };
const bread: TodoItem = { uid: 'b', summary: 'bread', status: 'needs_action', due: '2026-10-06' };
const eggs: TodoItem = { uid: 'c', summary: 'Eggs', status: 'completed', due: '2026-10-05' };

describe('todoAbilities', () => {
	it('reads each TodoListEntityFeature bit', () => {
		expect(todoAbilities(1 | 2 | 4)).toEqual({
			create: true,
			delete: true,
			update: true,
			move: false,
			due: false,
			description: false
		});
		expect(todoAbilities(8 | 32 | 64)).toMatchObject({
			create: false,
			move: true,
			due: true,
			description: true
		});
	});

	it('allows nothing without a number', () => {
		expect(Object.values(todoAbilities(undefined)).some(Boolean)).toBe(false);
		expect(Object.values(todoAbilities('7')).some(Boolean)).toBe(false);
	});
});

describe('parseTodoItems', () => {
	it('keeps well-formed items and drops the rest', () => {
		expect(
			parseTodoItems([
				{ uid: 'a', summary: 'Milk', status: 'needs_action', due: null },
				{ uid: 'b', summary: 'Tea', status: 'completed', description: 'green' },
				{ summary: 'no uid' },
				null,
				'text'
			])
		).toEqual([
			{ uid: 'a', summary: 'Milk', status: 'needs_action' },
			{ uid: 'b', summary: 'Tea', status: 'completed', description: 'green' }
		]);
		expect(parseTodoItems(undefined)).toEqual([]);
	});
});

describe('sortTodoItems', () => {
	const items = [milk, eggs, bread];

	it('keeps the list order for manual', () => {
		expect(sortTodoItems(items, 'manual')).toEqual(items);
		expect(sortTodoItems(items)).not.toBe(items);
	});

	it('sorts alphabetically regardless of case', () => {
		expect(sortTodoItems(items, 'alphabetical').map((item) => item.summary)).toEqual([
			'bread',
			'Eggs',
			'Milk'
		]);
	});

	it('sorts by due date with undated items last in list order', () => {
		const tea: TodoItem = { uid: 'd', summary: 'Tea', status: 'needs_action' };
		expect(sortTodoItems([milk, bread, tea, eggs], 'due').map((item) => item.uid)).toEqual([
			'c',
			'b',
			'a',
			'd'
		]);
	});
});

describe('todoDue', () => {
	const now = new Date(2026, 9, 5, 12, 0);

	it('counts calendar days for a date', () => {
		expect(todoDue('2026-10-05', now)).toMatchObject({ days: 0, timed: false, overdue: false });
		expect(todoDue('2026-10-06', now)).toMatchObject({ days: 1, overdue: false });
		expect(todoDue('2026-10-04', now)).toMatchObject({ days: -1, overdue: true });
	});

	it('marks a passed time today as overdue', () => {
		const earlier = new Date(2026, 9, 5, 9, 0).toISOString();
		expect(todoDue(earlier, now)).toMatchObject({ days: 0, timed: true, overdue: true });
	});

	it('ignores a missing or unreadable date', () => {
		expect(todoDue(undefined, now)).toBeNull();
		expect(todoDue('soon', now)).toBeNull();
	});
});

/** A list whose pushes and service results the test controls. */
function fakeSource() {
	let push: (items: TodoItem[]) => void = () => {};
	const results: ((ok: boolean) => void)[] = [];
	const refresh = vi.fn();
	const stop = vi.fn();
	const source: TodoSource = {
		subscribe: vi.fn(async (_entityId, onItems) => {
			push = onItems;
			return { stop, refresh };
		}),
		call: vi.fn(
			() =>
				new Promise<boolean>((resolve) => {
					results.push(resolve);
				})
		)
	};
	return {
		source,
		push: (items: TodoItem[]) => push(items),
		/** Answers the oldest call still waiting. */
		answer: async (ok: boolean) => {
			results.shift()?.(ok);
			await Promise.resolve();
			await Promise.resolve();
		},
		refresh,
		stop
	};
}

describe('createTodoList', () => {
	let fake: ReturnType<typeof fakeSource>;

	beforeEach(() => {
		vi.useFakeTimers();
		fake = fakeSource();
	});

	afterEach(() => vi.useRealTimers());

	async function started() {
		const list = createTodoList('todo.shopping', fake.source);
		await Promise.resolve();
		fake.push([milk, eggs]);
		return list;
	}

	it('shows nothing until the first list arrives', () => {
		const list = createTodoList('todo.shopping', fake.source);
		expect(get(list.items)).toBeNull();
	});

	it('shows an added item at once and sends add_item', async () => {
		const list = await started();
		list.add('  Bread ');
		expect(get(list.items)?.map((item) => item.summary)).toEqual(['Milk', 'Eggs', 'Bread']);
		expect(get(list.items)?.[2].local).toBe(true);
		expect(fake.source.call).toHaveBeenCalledWith('todo.shopping', 'add_item', { item: 'Bread' });
	});

	it('does not double an added item when the push beats the result', async () => {
		const list = await started();
		list.add('Bread');
		fake.push([milk, eggs, { uid: 'z', summary: 'Bread', status: 'needs_action' }]);
		expect(get(list.items)?.map((item) => item.uid)).toEqual(['a', 'c', 'z']);
		await fake.answer(true);
		expect(get(list.items)?.map((item) => item.uid)).toEqual(['a', 'c', 'z']);
	});

	it('completes an item at once and keeps it completed until the list confirms', async () => {
		const list = await started();
		list.setStatus('a', 'completed');
		expect(get(list.items)?.[0].status).toBe('completed');
		expect(fake.source.call).toHaveBeenCalledWith('todo.shopping', 'update_item', {
			item: 'a',
			status: 'completed'
		});
		await fake.answer(true);
		// accepted, but no list has shown it yet: the change holds and a poll is asked for
		expect(get(list.items)?.[0].status).toBe('completed');
		expect(fake.refresh).toHaveBeenCalled();
		fake.push([{ ...milk, status: 'completed' }, eggs]);
		// a later list without the change wins, since the change was confirmed and dropped
		fake.push([milk, eggs]);
		expect(get(list.items)?.[0].status).toBe('needs_action');
	});

	it('rolls a failed change back', async () => {
		const list = await started();
		list.setStatus('a', 'completed');
		list.remove('c');
		expect(get(list.items)?.map((item) => [item.uid, item.status])).toEqual([['a', 'completed']]);
		await fake.answer(false);
		expect(get(list.items)?.map((item) => [item.uid, item.status])).toEqual([
			['a', 'needs_action']
		]);
		await fake.answer(false);
		expect(get(list.items)).toEqual([milk, eggs]);
	});

	it('gives way to the list when no confirming push arrives', async () => {
		const list = await started();
		list.rename('a', 'Oat milk');
		await fake.answer(true);
		expect(get(list.items)?.[0].summary).toBe('Oat milk');
		vi.advanceTimersByTime(5000);
		expect(get(list.items)?.[0].summary).toBe('Milk');
	});

	it('sends uids for removals and clears only completed items', async () => {
		const list = await started();
		list.remove('a');
		expect(fake.source.call).toHaveBeenLastCalledWith('todo.shopping', 'remove_item', {
			item: ['a']
		});
		list.removeCompleted();
		expect(fake.source.call).toHaveBeenLastCalledWith(
			'todo.shopping',
			'remove_completed_items',
			{}
		);
		expect(get(list.items)).toEqual([]);
	});

	it('ignores blank text and stops its feed on destroy', async () => {
		const list = await started();
		list.add('   ');
		list.rename('a', '');
		expect(fake.source.call).not.toHaveBeenCalled();
		list.destroy();
		expect(fake.stop).toHaveBeenCalled();
	});
});

describe('homeAssistantTodoSource', () => {
	afterEach(() => connection.set(undefined));

	it('subscribes to todo/item/subscribe for live items', async () => {
		const stop = vi.fn(async () => {});
		const subscribeMessage = vi.fn(async (callback: (message: unknown) => void) => {
			callback({ items: [milk] });
			return stop;
		});
		connection.set({ subscribeMessage } as unknown as Connection);
		const onItems = vi.fn();
		const feed = await homeAssistantTodoSource.subscribe('todo.shopping', onItems);
		expect(subscribeMessage).toHaveBeenCalledWith(expect.any(Function), {
			type: 'todo/item/subscribe',
			entity_id: 'todo.shopping'
		});
		expect(onItems).toHaveBeenCalledWith([milk]);
		feed.stop();
		expect(stop).toHaveBeenCalled();
	});

	it('falls back to todo.get_items when the subscription is refused', async () => {
		const sendMessagePromise = vi.fn(async () => ({
			response: { 'todo.shopping': { items: [milk, eggs] } }
		}));
		connection.set({
			subscribeMessage: vi.fn(async () => {
				throw { code: 'unknown_command' };
			}),
			sendMessagePromise
		} as unknown as Connection);
		const onItems = vi.fn();
		const feed = await homeAssistantTodoSource.subscribe('todo.shopping', onItems);
		await vi.waitFor(() => expect(onItems).toHaveBeenCalledWith([milk, eggs]));
		expect(sendMessagePromise).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'call_service',
				domain: 'todo',
				service: 'get_items',
				target: { entity_id: 'todo.shopping' },
				return_response: true
			})
		);
		// the list's open count changing is the cue to ask again
		states.set({ 'todo.shopping': hassEntity('todo.shopping', '3') });
		await vi.waitFor(() => expect(sendMessagePromise).toHaveBeenCalledTimes(2));
		feed.refresh();
		await vi.waitFor(() => expect(sendMessagePromise).toHaveBeenCalledTimes(3));
		feed.stop();
		states.set({ 'todo.shopping': hassEntity('todo.shopping', '4') });
		await Promise.resolve();
		expect(sendMessagePromise).toHaveBeenCalledTimes(3);
	});
});
