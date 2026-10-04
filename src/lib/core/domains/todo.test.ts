import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Connection } from 'home-assistant-js-websocket';
import { connection, health } from '../ha/connection';
import { states } from '../ha/entities';
import { hassEntity } from '../ha/testing';
import {
	createTodoList,
	homeAssistantTodoSource,
	nextStamp,
	parseTodoItems,
	sortTodoItems,
	todoAbilities,
	todoDue,
	type TodoFeedHandlers,
	type TodoItem,
	type TodoSource
} from './todo';

function item(uid: string, summary: string, extra: Partial<TodoItem> = {}): TodoItem {
	return { key: `uid:${uid}`, target: uid, summary, status: 'needs_action', ...extra };
}

const milk = item('a', 'Milk');
const bread = item('b', 'bread', { due: '2026-10-06' });
const eggs = item('c', 'Eggs', { status: 'completed', due: '2026-10-05' });

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
				{ uid: 'c' },
				null,
				'text'
			])
		).toEqual([item('a', 'Milk'), item('b', 'Tea', { status: 'completed', description: 'green' })]);
		expect(parseTodoItems(undefined)).toEqual([]);
	});

	it('names an item without a uid by its summary, unless the summary repeats', () => {
		const [jam, first, second] = parseTodoItems([
			{ summary: 'Jam', status: 'needs_action' },
			{ summary: 'Tea', status: 'needs_action' },
			{ uid: '', summary: 'Tea', status: 'completed' }
		]);
		expect(jam).toMatchObject({ key: 'summary:0:Jam', target: 'Jam' });
		expect(first.key).not.toBe(second.key);
		expect(first.target).toBeUndefined();
		expect(second.target).toBeUndefined();
	});
});

describe('sortTodoItems', () => {
	const items = [milk, eggs, bread];

	it('keeps the list order for manual', () => {
		expect(sortTodoItems(items, 'manual')).toEqual(items);
		expect(sortTodoItems(items)).not.toBe(items);
	});

	it('sorts alphabetically regardless of case', () => {
		expect(sortTodoItems(items, 'alphabetical').map((entry) => entry.summary)).toEqual([
			'bread',
			'Eggs',
			'Milk'
		]);
	});

	it('sorts by due date with undated items last in list order', () => {
		const tea = item('d', 'Tea');
		expect(sortTodoItems([milk, bread, tea, eggs], 'due').map((entry) => entry.target)).toEqual([
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

/** A list whose lists and service results the test controls. */
function fakeSource(pushes = true) {
	let handlers: TodoFeedHandlers | null = null;
	const results: ((ok: boolean) => void)[] = [];
	// a poll asked now answers later, with the stamp of the asking
	const asked: number[] = [];
	const refresh = vi.fn(() => asked.push(nextStamp()));
	const stop = vi.fn();
	const source: TodoSource = {
		subscribe: vi.fn((_entityId, next) => {
			handlers = next;
			return { stop, refresh, pushes };
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
		/** A list asked for (and so stamped) now. */
		push: (items: TodoItem[]) => handlers?.items(items, nextStamp()),
		/** Stamps a poll now, answered later through `answerPoll`. */
		ask: () => asked.push(nextStamp()),
		answerPoll: (items: TodoItem[]) => handlers?.items(items, asked.shift()!),
		unavailable: () => handlers?.unavailable(),
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
	const onRollback = vi.fn();

	beforeEach(() => {
		vi.useFakeTimers();
		fake = fakeSource();
		onRollback.mockClear();
	});

	afterEach(() => vi.useRealTimers());

	function started() {
		const list = createTodoList('todo.shopping', { source: fake.source, onRollback });
		fake.push([milk, eggs]);
		return list;
	}

	it('shows nothing until the first list arrives', () => {
		const list = createTodoList('todo.shopping', { source: fake.source });
		expect(get(list.items)).toBeNull();
		expect(get(list.status)).toBe('loading');
		fake.push([]);
		expect(get(list.status)).toBe('ready');
	});

	it('reports a list Home Assistant does not know', () => {
		const list = started();
		fake.unavailable();
		expect(get(list.status)).toBe('unavailable');
		expect(get(list.items)).toBeNull();
	});

	it('shows an added item at once and sends add_item', () => {
		const list = started();
		list.add('  Bread ');
		expect(get(list.items)?.map((entry) => entry.summary)).toEqual(['Milk', 'Eggs', 'Bread']);
		expect(get(list.items)?.[2].local).toBe(true);
		expect(fake.source.call).toHaveBeenCalledWith('todo.shopping', 'add_item', { item: 'Bread' });
	});

	it('does not double an added item when the push beats the result', async () => {
		const list = started();
		list.add('Bread');
		fake.push([milk, eggs, item('z', 'Bread')]);
		expect(get(list.items)?.map((entry) => entry.key)).toEqual(['uid:a', 'uid:c', 'uid:z']);
		await fake.answer(true);
		expect(get(list.items)?.map((entry) => entry.key)).toEqual(['uid:a', 'uid:c', 'uid:z']);
	});

	it('shows both of two quick adds of the same text', () => {
		const list = started();
		list.add('Bread');
		list.add('Bread');
		expect(get(list.items)?.filter((entry) => entry.summary === 'Bread')).toHaveLength(2);
		// the first echo arrives: one item is real, the other still local
		fake.push([milk, eggs, item('y', 'Bread')]);
		const breads = get(list.items)?.filter((entry) => entry.summary === 'Bread');
		expect(breads?.map((entry) => Boolean(entry.local))).toEqual([false, true]);
		fake.push([milk, eggs, item('y', 'Bread'), item('z', 'Bread')]);
		expect(get(list.items)?.filter((entry) => entry.summary === 'Bread')).toHaveLength(2);
	});

	it('completes an item at once and keeps it completed until a list confirms', async () => {
		const list = started();
		list.setStatus('uid:a', 'completed');
		expect(get(list.items)?.[0].status).toBe('completed');
		expect(fake.source.call).toHaveBeenCalledWith('todo.shopping', 'update_item', {
			item: 'a',
			status: 'completed'
		});
		await fake.answer(true);
		expect(get(list.items)?.[0].status).toBe('completed');
		fake.push([{ ...milk, status: 'completed' }, eggs]);
		// confirmed and dropped: a later list without the change wins
		fake.push([milk, eggs]);
		expect(get(list.items)?.[0].status).toBe('needs_action');
	});

	it('edits an item without a uid by its summary', () => {
		const list = createTodoList('todo.shopping', { source: fake.source });
		const [jam] = parseTodoItems([{ summary: 'Jam', status: 'needs_action' }]);
		fake.push([jam]);
		list.setStatus(jam.key, 'completed');
		list.remove(jam.key);
		expect(fake.source.call).toHaveBeenNthCalledWith(1, 'todo.shopping', 'update_item', {
			item: 'Jam',
			status: 'completed'
		});
		expect(fake.source.call).toHaveBeenNthCalledWith(2, 'todo.shopping', 'remove_item', {
			item: ['Jam']
		});
	});

	it('leaves items it cannot name alone', () => {
		const list = started();
		list.add('Bread');
		const local = get(list.items)![2];
		vi.mocked(fake.source.call).mockClear();
		list.setStatus(local.key, 'completed');
		list.remove(local.key);
		list.rename('uid:a', 'Milk');
		expect(fake.source.call).not.toHaveBeenCalled();
	});

	it('rolls a failed change back and says so', async () => {
		const list = started();
		list.setStatus('uid:a', 'completed');
		list.remove('uid:c');
		expect(get(list.items)?.map((entry) => [entry.target, entry.status])).toEqual([
			['a', 'completed']
		]);
		await fake.answer(false);
		expect(get(list.items)?.map((entry) => [entry.target, entry.status])).toEqual([
			['a', 'needs_action']
		]);
		expect(onRollback).toHaveBeenCalledWith('Milk');
		await fake.answer(false);
		expect(get(list.items)).toEqual([milk, eggs]);
		expect(onRollback).toHaveBeenLastCalledWith('Eggs');
	});

	it('gives way to the list when no confirming list arrives', async () => {
		const list = started();
		list.rename('uid:a', 'Oat milk');
		await fake.answer(true);
		expect(get(list.items)?.[0].summary).toBe('Oat milk');
		vi.advanceTimersByTime(5000);
		expect(get(list.items)?.[0].summary).toBe('Milk');
	});

	it('sends uids for removals and clears only completed items', () => {
		const list = started();
		list.remove('uid:a');
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

	it('ignores blank text and stops its feed on destroy', () => {
		const list = started();
		list.add('   ');
		list.rename('uid:a', '');
		expect(fake.source.call).not.toHaveBeenCalled();
		list.destroy();
		expect(fake.stop).toHaveBeenCalled();
	});

	describe('while polling', () => {
		beforeEach(() => {
			fake = fakeSource(false);
		});

		it('only counts a list asked for after the change was accepted', async () => {
			const list = started();
			list.setStatus('uid:a', 'completed');
			// asked after sending but before Home Assistant took the change
			fake.ask();
			await fake.answer(true);
			expect(fake.refresh).toHaveBeenCalled();
			fake.answerPoll([milk, eggs]);
			expect(get(list.items)?.[0].status).toBe('completed');
			// the refresh after acceptance holds the change, and confirms it
			fake.answerPoll([{ ...milk, status: 'completed' }, eggs]);
			fake.push([milk, eggs]);
			expect(get(list.items)?.[0].status).toBe('needs_action');
		});
	});
});

describe('homeAssistantTodoSource', () => {
	const handlers = () => ({ items: vi.fn(), unavailable: vi.fn() });

	beforeEach(() => health.set('connected'));

	afterEach(() => {
		vi.useRealTimers();
		connection.set(undefined);
		health.set('booting');
	});

	it('subscribes to todo/item/subscribe for live items', async () => {
		const stop = vi.fn(async () => {});
		const subscribeMessage = vi.fn(async (callback: (message: unknown) => void) => {
			callback({ items: [{ uid: 'a', summary: 'Milk', status: 'needs_action' }] });
			return stop;
		});
		connection.set({ subscribeMessage } as unknown as Connection);
		const listener = handlers();
		const feed = homeAssistantTodoSource.subscribe('todo.shopping', listener);
		await vi.waitFor(() => expect(listener.items).toHaveBeenCalledWith([milk], expect.any(Number)));
		expect(subscribeMessage).toHaveBeenCalledWith(
			expect.any(Function),
			{ type: 'todo/item/subscribe', entity_id: 'todo.shopping' },
			{ resubscribe: false }
		);
		expect(feed.pushes).toBe(true);
		feed.stop();
		expect(stop).toHaveBeenCalled();
	});

	it('subscribes afresh after a reconnect and leaves a list stopped while offline alone', async () => {
		const callbacks: ((message: unknown) => void)[] = [];
		const stop = vi.fn(async () => {});
		const subscribeMessage = vi.fn(async (callback: (message: unknown) => void) => {
			callbacks.push(callback);
			return stop;
		});
		connection.set({ subscribeMessage } as unknown as Connection);
		const listener = handlers();
		const feed = homeAssistantTodoSource.subscribe('todo.shopping', listener);
		const other = homeAssistantTodoSource.subscribe('todo.chores', handlers());
		await vi.waitFor(() => expect(subscribeMessage).toHaveBeenCalledTimes(2));

		health.set('lost');
		other.stop();
		health.set('connected');
		await vi.waitFor(() => expect(subscribeMessage).toHaveBeenCalledTimes(3));
		expect(subscribeMessage).toHaveBeenNthCalledWith(
			3,
			expect.any(Function),
			{ type: 'todo/item/subscribe', entity_id: 'todo.shopping' },
			{ resubscribe: false }
		);

		// the subscription from before the drop is gone; only the new one counts
		callbacks[0]({ items: [{ uid: 'b', summary: 'Eggs', status: 'needs_action' }] });
		expect(listener.items).not.toHaveBeenCalled();
		callbacks[2]({ items: [{ uid: 'a', summary: 'Milk', status: 'needs_action' }] });
		expect(listener.items).toHaveBeenCalledWith([milk], expect.any(Number));
		feed.stop();
		health.set('lost');
		health.set('connected');
		await Promise.resolve();
		expect(subscribeMessage).toHaveBeenCalledTimes(3);
	});

	it('drops a subscription that answers only after its socket was replaced', async () => {
		let answer: (stop: () => Promise<void>) => void = () => {};
		const stale = vi.fn(async () => {});
		const first = {
			subscribeMessage: vi.fn(
				() => new Promise<() => Promise<void>>((resolve) => (answer = resolve))
			)
		};
		const second = { subscribeMessage: vi.fn(async () => async () => {}) };
		connection.set(first as unknown as Connection);
		const feed = homeAssistantTodoSource.subscribe('todo.shopping', handlers());
		expect(first.subscribeMessage).toHaveBeenCalledTimes(1);
		connection.set(second as unknown as Connection);
		expect(second.subscribeMessage).toHaveBeenCalledTimes(1);
		answer(stale);
		await vi.waitFor(() => expect(stale).toHaveBeenCalled());
		feed.stop();
	});

	it('falls back to todo.get_items only where the command is unknown', async () => {
		const sendMessagePromise = vi.fn(async () => ({
			response: {
				'todo.shopping': { items: [{ uid: 'a', summary: 'Milk', status: 'needs_action' }] }
			}
		}));
		connection.set({
			subscribeMessage: vi.fn(async () => {
				throw { code: 'unknown_command', message: 'Unknown command.' };
			}),
			sendMessagePromise
		} as unknown as Connection);
		const listener = handlers();
		const feed = homeAssistantTodoSource.subscribe('todo.shopping', listener);
		await vi.waitFor(() => expect(listener.items).toHaveBeenCalledWith([milk], expect.any(Number)));
		expect(feed.pushes).toBe(false);
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

	it('reports a polled list that never answers as unavailable', async () => {
		connection.set({
			subscribeMessage: vi.fn(async () => {
				throw { code: 'unknown_command' };
			}),
			sendMessagePromise: vi.fn(async () => {
				throw {
					code: 'service_validation_error',
					message: 'Service call requested response data but did not match any entities'
				};
			})
		} as unknown as Connection);
		const listener = handlers();
		const feed = homeAssistantTodoSource.subscribe('todo.gone', listener);
		await vi.waitFor(() => expect(listener.unavailable).toHaveBeenCalled());
		feed.stop();
	});

	it('marks a missing list unavailable and retries other refusals with a growing pause', async () => {
		vi.useFakeTimers();
		const subscribeMessage = vi
			.fn()
			.mockRejectedValueOnce({ code: 'not_found', message: 'Entity not found' })
			.mockRejectedValueOnce({ code: 'home_assistant_error', message: 'busy' })
			.mockResolvedValue(async () => {});
		connection.set({ subscribeMessage } as unknown as Connection);
		const listener = handlers();
		const feed = homeAssistantTodoSource.subscribe('todo.shopping', listener);
		await vi.advanceTimersByTimeAsync(0);
		expect(listener.unavailable).toHaveBeenCalledTimes(1);
		expect(subscribeMessage).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(2000);
		expect(subscribeMessage).toHaveBeenCalledTimes(2);
		// the second pause is twice as long
		await vi.advanceTimersByTimeAsync(2000);
		expect(subscribeMessage).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(2000);
		expect(subscribeMessage).toHaveBeenCalledTimes(3);
		expect(listener.unavailable).toHaveBeenCalledTimes(1);
		feed.stop();
	});
});
