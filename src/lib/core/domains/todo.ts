import { get, writable, type Readable } from 'svelte/store';
import { connection } from '../ha/connection';
import { callEntityService } from '../ha/commands';
import { states } from '../ha/entities';
import { DATA_REFRESH_MS } from '../ha/history';
import { calendarDaysBetween, parseLocalDate } from '../i18n/time';

export type TodoStatus = 'needs_action' | 'completed';

/** One item as Home Assistant sends it; `due` is YYYY-MM-DD or an ISO datetime. */
export interface TodoItem {
	uid: string;
	summary: string;
	status: TodoStatus;
	due?: string;
	description?: string;
	/** Added here and not yet confirmed: it has no uid Home Assistant knows. */
	local?: true;
}

export type TodoSort = 'manual' | 'alphabetical' | 'due';

// TodoListEntityFeature
const CREATE = 1;
const DELETE = 2;
const UPDATE = 4;
const MOVE = 8;
const SET_DUE_DATE = 16;
const SET_DUE_DATETIME = 32;
const SET_DESCRIPTION = 64;

export interface TodoAbilities {
	create: boolean;
	delete: boolean;
	update: boolean;
	move: boolean;
	due: boolean;
	description: boolean;
}

/** What a list lets the dashboard change, from its supported_features bits. */
export function todoAbilities(features: unknown): TodoAbilities {
	const bits = typeof features === 'number' ? features : 0;
	const has = (bit: number) => (bits & bit) === bit;
	return {
		create: has(CREATE),
		delete: has(DELETE),
		update: has(UPDATE),
		move: has(MOVE),
		due: has(SET_DUE_DATE) || has(SET_DUE_DATETIME),
		description: has(SET_DESCRIPTION)
	};
}

/** The items of a subscription event or get_items response, dropping malformed entries. */
export function parseTodoItems(raw: unknown): TodoItem[] {
	if (!Array.isArray(raw)) return [];
	return raw.flatMap((entry): TodoItem[] => {
		if (!entry || typeof entry !== 'object') return [];
		const { uid, summary, status, due, description } = entry as Record<string, unknown>;
		if (typeof uid !== 'string' || typeof summary !== 'string') return [];
		return [
			{
				uid,
				summary,
				status: status === 'completed' ? 'completed' : 'needs_action',
				...(typeof due === 'string' && due ? { due } : {}),
				...(typeof description === 'string' && description ? { description } : {})
			}
		];
	});
}

function dueTime(item: TodoItem): number {
	if (!item.due) return Infinity;
	const time = parseLocalDate(item.due).getTime();
	return Number.isNaN(time) ? Infinity : time;
}

/** A sorted copy; `manual` keeps Home Assistant's order, undated items sort last by due date. */
export function sortTodoItems(items: readonly TodoItem[], sort: TodoSort = 'manual'): TodoItem[] {
	const sorted = [...items];
	if (sort === 'alphabetical') {
		sorted.sort((a, b) => a.summary.localeCompare(b.summary, undefined, { sensitivity: 'base' }));
	} else if (sort === 'due') {
		// Array.sort is stable, so items due together keep the list's own order
		sorted.sort((a, b) => {
			const difference = dueTime(a) - dueTime(b);
			return Number.isNaN(difference) ? 0 : difference;
		});
	}
	return sorted;
}

export interface TodoDue {
	/** Whole calendar days from today; negative when overdue. */
	days: number;
	/** Whether `due` carries a time of day, not just a date. */
	timed: boolean;
	date: Date;
	overdue: boolean;
}

/** Where an item's due date falls relative to `now`, or null without a readable one. */
export function todoDue(due: string | undefined, now: Date): TodoDue | null {
	if (!due) return null;
	const date = parseLocalDate(due);
	if (Number.isNaN(date.getTime())) return null;
	const timed = due.includes('T');
	const days = calendarDaysBetween(now, date);
	return { days, timed, date, overdue: timed ? date < now : days < 0 };
}

/** The connection a list's items arrive through; swapped for a fake in tests. */
export interface TodoSource {
	/** Starts delivering the full item list; resolves with the handle that ends it. */
	subscribe(entityId: string, onItems: (items: TodoItem[]) => void): Promise<TodoFeed>;
	/** Calls todo.<service> on the list; false when it was refused or failed. */
	call(entityId: string, service: string, data: Record<string, unknown>): Promise<boolean>;
}

export interface TodoFeed {
	stop(): void;
	/** Asks again now, where the feed polls; a push feed needs nothing. */
	refresh(): void;
}

async function fetchTodoItems(entityId: string): Promise<TodoItem[]> {
	const conn = get(connection);
	if (!conn) throw new Error('Not connected to Home Assistant');
	const result = await conn.sendMessagePromise<{
		response?: Record<string, { items?: unknown }>;
	}>({
		type: 'call_service',
		domain: 'todo',
		service: 'get_items',
		target: { entity_id: entityId },
		service_data: { status: ['needs_action', 'completed'] },
		return_response: true
	});
	return parseTodoItems(result?.response?.[entityId]?.items);
}

/*
 * Before todo/item/subscribe (and for lists whose integration rejects it)
 * the items only come from todo.get_items. The list's state is its open item
 * count, so a state change is the cue to ask again; the interval catches a
 * rename or a completed item, which leave the count alone.
 */
function pollTodoItems(entityId: string, onItems: (items: TodoItem[]) => void): TodoFeed {
	let active = true;
	let latest = 0;
	const load = async () => {
		const request = ++latest;
		try {
			const items = await fetchTodoItems(entityId);
			// an older answer arriving after a newer one must not win
			if (active && request === latest) onItems(items);
		} catch {
			// keep the last list; the next cue asks again
		}
	};
	let seen = get(states)?.[entityId];
	const unsubscribe = states.subscribe(($states) => {
		const entity = $states?.[entityId];
		if (entity === seen) return;
		seen = entity;
		void load();
	});
	const timer = setInterval(load, DATA_REFRESH_MS);
	void load();
	return {
		stop() {
			active = false;
			clearInterval(timer);
			unsubscribe();
		},
		refresh: () => void load()
	};
}

export const homeAssistantTodoSource: TodoSource = {
	async subscribe(entityId, onItems) {
		const conn = get(connection);
		if (!conn) throw new Error('Not connected to Home Assistant');
		try {
			const stop = await conn.subscribeMessage<{ items?: unknown }>(
				(message) => onItems(parseTodoItems(message?.items)),
				{ type: 'todo/item/subscribe', entity_id: entityId }
			);
			return { stop: () => void stop().catch(() => {}), refresh: () => {} };
		} catch {
			return pollTodoItems(entityId, onItems);
		}
	},
	call: (entityId, service, data) => callEntityService('todo', service, entityId, data)
};

interface PendingChange {
	apply: (items: TodoItem[]) => TodoItem[];
	/** A list arrived after the change was sent, so the list may already show it. */
	listArrived: boolean;
	/** Home Assistant accepted the change; it goes once a list confirms it. */
	accepted: boolean;
}

/** How long an accepted change waits for a list that shows it before giving way. */
const SETTLE_MS = 5000;

export interface TodoList {
	/** The items with every unconfirmed change applied; null until the first list arrives. */
	items: Readable<TodoItem[] | null>;
	add(summary: string): void;
	setStatus(uid: string, status: TodoStatus): void;
	rename(uid: string, summary: string): void;
	remove(uid: string): void;
	removeCompleted(): void;
	destroy(): void;
}

/**
 * A live to-do list with optimistic changes: each change shows at once and
 * stays layered over the items Home Assistant sends until a list arrives that
 * already holds it. A refused or failed change simply drops out, which rolls
 * the view back. Every change is written so applying it to a list that
 * already holds it changes nothing.
 */
export function createTodoList(entityId: string, source: TodoSource = homeAssistantTodoSource) {
	const items = writable<TodoItem[] | null>(null);
	let confirmed: TodoItem[] | null = null;
	let pending: PendingChange[] = [];
	let feed: TodoFeed | null = null;
	let destroyed = false;
	const timers = new Set<ReturnType<typeof setTimeout>>();
	let localIds = 0;

	function publish() {
		items.set(confirmed && pending.reduce((list, change) => change.apply(list), confirmed));
	}

	function drop(change: PendingChange) {
		pending = pending.filter((entry) => entry !== change);
		publish();
	}

	source
		.subscribe(entityId, (list) => {
			if (destroyed) return;
			confirmed = list;
			pending = pending.filter((change) => !change.accepted);
			for (const change of pending) change.listArrived = true;
			publish();
		})
		.then(
			(started) => {
				if (destroyed) started.stop();
				else feed = started;
			},
			() => {
				if (!destroyed) items.set([]);
			}
		);

	function change(
		apply: PendingChange['apply'],
		service: string,
		data: Record<string, unknown>
	): void {
		const entry: PendingChange = { apply, listArrived: false, accepted: false };
		pending = [...pending, entry];
		publish();
		void source.call(entityId, service, data).then((ok) => {
			if (destroyed) return;
			if (!ok || entry.listArrived) {
				drop(entry);
				return;
			}
			entry.accepted = true;
			feed?.refresh();
			const timer = setTimeout(() => {
				timers.delete(timer);
				if (pending.includes(entry)) drop(entry);
			}, SETTLE_MS);
			timers.add(timer);
		});
	}

	const list: TodoList = {
		items: { subscribe: items.subscribe },
		add(summary) {
			const text = summary.trim();
			if (!text) return;
			const known = new Set((confirmed ?? []).map((item) => item.uid));
			const uid = `local-${++localIds}`;
			change(
				(current) =>
					// the confirming list holds it under its real uid
					current.some(
						(item) =>
							!known.has(item.uid) && item.summary === text && item.status === 'needs_action'
					)
						? current
						: [...current, { uid, summary: text, status: 'needs_action', local: true }],
				'add_item',
				{ item: text }
			);
		},
		setStatus(uid, status) {
			change(
				(current) => current.map((item) => (item.uid === uid ? { ...item, status } : item)),
				'update_item',
				{ item: uid, status }
			);
		},
		rename(uid, summary) {
			const text = summary.trim();
			if (!text) return;
			change(
				(current) => current.map((item) => (item.uid === uid ? { ...item, summary: text } : item)),
				'update_item',
				{ item: uid, rename: text }
			);
		},
		remove(uid) {
			change((current) => current.filter((item) => item.uid !== uid), 'remove_item', {
				item: [uid]
			});
		},
		removeCompleted() {
			const done = new Set(
				(get(items) ?? []).filter((item) => item.status === 'completed').map((item) => item.uid)
			);
			if (!done.size) return;
			change(
				(current) => current.filter((item) => !done.has(item.uid)),
				'remove_completed_items',
				{}
			);
		},
		destroy() {
			destroyed = true;
			feed?.stop();
			feed = null;
			for (const timer of timers) clearTimeout(timer);
			timers.clear();
		}
	};
	return list;
}
