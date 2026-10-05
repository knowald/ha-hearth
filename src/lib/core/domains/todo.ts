import { get, writable, type Readable } from 'svelte/store';
import type { Connection } from 'home-assistant-js-websocket';
import { connection, health, type ConnectionHealth } from '../ha/connection';
import { callEntityService } from '../ha/commands';
import { states } from '../ha/entities';
import { DATA_REFRESH_MS } from '../ha/history';
import { calendarDaysBetween, parseLocalDate } from '../i18n/time';

export type TodoStatus = 'needs_action' | 'completed';

/** One item as Home Assistant sends it; `due` is YYYY-MM-DD or an ISO datetime. */
export interface TodoItem {
	/** Stable within one list: the uid, or one made up from the summary when there is none. */
	key: string;
	/**
	 * What todo.update_item and todo.remove_item name the item by: the uid, or
	 * the summary for an item without one. Unset where neither identifies it:
	 * an item added here and not yet confirmed, or a uid-less summary that
	 * appears twice.
	 */
	target?: string;
	summary: string;
	status: TodoStatus;
	due?: string;
	description?: string;
	/** Added here and not yet confirmed by Home Assistant. */
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
	const entries = raw.filter(
		(entry): entry is Record<string, unknown> =>
			Boolean(entry) && typeof entry === 'object' && typeof entry.summary === 'string'
	);
	const uidless = (entry: Record<string, unknown>) => typeof entry.uid !== 'string' || !entry.uid;
	const summaryCount = new Map<string, number>();
	for (const entry of entries.filter(uidless)) {
		const summary = entry.summary as string;
		summaryCount.set(summary, (summaryCount.get(summary) ?? 0) + 1);
	}
	const seen = new Map<string, number>();
	return entries.map((entry): TodoItem => {
		const summary = entry.summary as string;
		const { uid, status, due, description } = entry;
		let identity: Pick<TodoItem, 'key' | 'target'>;
		if (!uidless(entry)) {
			identity = { key: `uid:${uid}`, target: uid as string };
		} else {
			const occurrence = seen.get(summary) ?? 0;
			seen.set(summary, occurrence + 1);
			identity = {
				key: `summary:${occurrence}:${summary}`,
				...(summaryCount.get(summary) === 1 ? { target: summary } : {})
			};
		}
		return {
			...identity,
			summary,
			status: status === 'completed' ? 'completed' : 'needs_action',
			...(typeof due === 'string' && due ? { due } : {}),
			...(typeof description === 'string' && description ? { description } : {})
		};
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

/*
 * Orders list requests against sent changes. A polled list answers the
 * question as it stood when it was asked, so only a list asked for after a
 * change was accepted can confirm it.
 */
let lastStamp = 0;
/** The next point on that order; a TodoSource stamps each list request with one. */
export function nextStamp(): number {
	lastStamp += 1;
	return lastStamp;
}

export interface TodoFeedHandlers {
	/** A full item list, with the stamp of the moment it was asked for. */
	items(items: TodoItem[], stamp: number): void;
	/** Home Assistant does not know the list. */
	unavailable(): void;
}

/** The connection a list's items arrive through; swapped for a fake in tests. */
export interface TodoSource {
	/** Starts delivering the list; the handle ends it. */
	subscribe(entityId: string, handlers: TodoFeedHandlers): TodoFeed;
	/** Calls todo.<service> on the list; false when it was refused or failed. */
	call(entityId: string, service: string, data: Record<string, unknown>): Promise<boolean>;
}

export interface TodoFeed {
	stop(): void;
	/** Asks again now, where the feed polls; a push feed needs nothing. */
	refresh(): void;
	/** Whether Home Assistant pushes each change, so the next list after one holds it. */
	readonly pushes: boolean;
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
 * Before todo/item/subscribe the items only come from todo.get_items. The
 * list's state is its open item count, so a state change is the cue to ask
 * again; the interval catches a rename or a completed item, which leave the
 * count alone.
 */
function pollTodoItems(entityId: string, handlers: TodoFeedHandlers): TodoFeed {
	let active = true;
	let latest = 0;
	let answered = false;
	const load = async () => {
		const stamp = nextStamp();
		latest = stamp;
		try {
			const items = await fetchTodoItems(entityId);
			// an older answer arriving after a newer one must not win
			if (!active || stamp !== latest) return;
			answered = true;
			handlers.items(items, stamp);
		} catch {
			// a list that never answered is not there; one that did keeps its
			// last items until the next cue asks again
			if (active && !answered) handlers.unavailable();
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
		refresh: () => void load(),
		pushes: false
	};
}

const RETRY_MS = 2000;
const RETRY_MAX_MS = 60_000;

function errorCode(error: unknown): unknown {
	return error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
}

// a degraded socket is open, only some other subscription failed
function isLive(state: ConnectionHealth) {
	return state === 'connected' || state === 'degraded';
}

/**
 * Subscribes to todo/item/subscribe. Only a Home Assistant without the
 * command falls back to polling; any other refusal retries with a growing
 * pause, since a list that is missing now may come back with its integration.
 * The subscription is made afresh for each live socket rather than re-sent by
 * the library, which would re-send it after a drop even once it was stopped.
 */
export const homeAssistantTodoSource: TodoSource = {
	subscribe(entityId, handlers) {
		let stopped = false;
		let polling: TodoFeed | null = null;
		// the subscription on one socket; answers for an older one are ignored
		let run: { conn: Connection; stop?: () => void } | null = null;
		let attempt = 0;
		let timer: ReturnType<typeof setTimeout> | undefined;

		async function start(conn: Connection) {
			const current: { conn: Connection; stop?: () => void } = { conn };
			run = current;
			try {
				const unsubscribe = await conn.subscribeMessage<{ items?: unknown }>(
					(message) => {
						if (run === current) handlers.items(parseTodoItems(message?.items), nextStamp());
					},
					{ type: 'todo/item/subscribe', entity_id: entityId },
					{ resubscribe: false }
				);
				const stop = () => void unsubscribe().catch(() => {});
				if (run !== current) return stop();
				current.stop = stop;
				attempt = 0;
			} catch (error) {
				if (run !== current) return;
				run = null;
				const code = errorCode(error);
				if (code === 'unknown_command') {
					polling = pollTodoItems(entityId, handlers);
					return;
				}
				if (code === 'not_found') handlers.unavailable();
				timer = setTimeout(
					() => {
						timer = undefined;
						sync();
					},
					Math.min(RETRY_MAX_MS, RETRY_MS * 2 ** attempt)
				);
				attempt += 1;
			}
		}

		function sync() {
			if (stopped || polling) return;
			const conn = get(connection);
			const live = conn && isLive(get(health)) ? conn : undefined;
			// a subscription still in flight on a dropped socket never answers
			if (run && run.conn !== live) {
				run.stop?.();
				run = null;
			}
			if (!live) {
				clearTimeout(timer);
				timer = undefined;
				attempt = 0;
				return;
			}
			if (!run && timer === undefined) void start(live);
		}

		const stopConnection = connection.subscribe(sync);
		const stopHealth = health.subscribe(sync);
		return {
			stop() {
				stopped = true;
				stopConnection();
				stopHealth();
				clearTimeout(timer);
				run?.stop?.();
				run = null;
				polling?.stop();
			},
			refresh: () => polling?.refresh(),
			get pushes() {
				return !polling;
			}
		};
	},
	call: (entityId, service, data) => callEntityService('todo', service, entityId, data)
};

interface PendingChange {
	apply: (items: TodoItem[], claimed: Set<string>) => TodoItem[];
	/** The summary of the item it touches, for the rollback announcement. */
	summary: string;
	sent: number;
	/** A list newer than the change arrived, so a pushed list may already show it. */
	listArrived: boolean;
	/** Set once Home Assistant accepted the change; a list asked for after it confirms it. */
	accepted?: number;
}

/** How long an accepted change waits for a list that shows it before giving way. */
const SETTLE_MS = 5000;

export type TodoListStatus = 'loading' | 'ready' | 'unavailable';

export interface TodoList {
	/** The items with every unconfirmed change applied; null until the first list arrives. */
	items: Readable<TodoItem[] | null>;
	status: Readable<TodoListStatus>;
	add(summary: string): void;
	setStatus(key: string, status: TodoStatus): void;
	rename(key: string, summary: string): void;
	remove(key: string): void;
	removeCompleted(): void;
	destroy(): void;
}

export interface TodoListOptions {
	source?: TodoSource;
	/** A change Home Assistant refused or failed, now taken back off the list. */
	onRollback?: (summary: string) => void;
}

/**
 * A live to-do list with optimistic changes: each change shows at once and
 * stays layered over the items Home Assistant sends until a list arrives that
 * already holds it. A refused or failed change drops out, which rolls the
 * view back. Applying a change to a list that already holds it changes
 * nothing, so a confirming list arriving early never doubles it.
 */
export function createTodoList(entityId: string, options: TodoListOptions = {}): TodoList {
	const source = options.source ?? homeAssistantTodoSource;
	const items = writable<TodoItem[] | null>(null);
	const status = writable<TodoListStatus>('loading');
	let confirmed: TodoItem[] | null = null;
	let pending: PendingChange[] = [];
	let destroyed = false;
	const timers = new Set<ReturnType<typeof setTimeout>>();
	let localIds = 0;

	function publish() {
		const claimed = new Set<string>();
		items.set(
			confirmed && pending.reduce((list, change) => change.apply(list, claimed), confirmed)
		);
	}

	function drop(change: PendingChange) {
		pending = pending.filter((entry) => entry !== change);
		publish();
	}

	const feed = source.subscribe(entityId, {
		items(list, stamp) {
			if (destroyed) return;
			confirmed = list;
			pending = pending.filter(
				(change) => change.accepted === undefined || stamp < change.accepted
			);
			for (const change of pending) if (stamp > change.sent) change.listArrived = true;
			status.set('ready');
			publish();
		},
		unavailable() {
			if (destroyed) return;
			confirmed = null;
			pending = [];
			status.set('unavailable');
			publish();
		}
	});

	function current(key: string): TodoItem | undefined {
		return get(items)?.find((item) => item.key === key);
	}

	function change(
		summary: string,
		apply: PendingChange['apply'],
		service: string,
		data: Record<string, unknown>
	): void {
		const entry: PendingChange = { apply, summary, sent: nextStamp(), listArrived: false };
		pending = [...pending, entry];
		publish();
		void source.call(entityId, service, data).then((ok) => {
			if (destroyed || !pending.includes(entry)) return;
			if (!ok) {
				drop(entry);
				options.onRollback?.(summary);
				return;
			}
			if (feed.pushes && entry.listArrived) {
				drop(entry);
				return;
			}
			entry.accepted = nextStamp();
			feed.refresh();
			const timer = setTimeout(() => {
				timers.delete(timer);
				if (pending.includes(entry)) drop(entry);
			}, SETTLE_MS);
			timers.add(timer);
		});
	}

	return {
		items: { subscribe: items.subscribe },
		status: { subscribe: status.subscribe },
		add(summary) {
			const text = summary.trim();
			if (!text) return;
			const known = new Set((confirmed ?? []).map((item) => item.key));
			const key = `local:${++localIds}`;
			change(
				text,
				(list, claimed) => {
					// the confirming list holds it under a key of its own; each add
					// claims one echo, so two quick adds of the same text both show
					const echo = list.find(
						(item) =>
							!item.local &&
							!known.has(item.key) &&
							!claimed.has(item.key) &&
							item.summary === text &&
							item.status === 'needs_action'
					);
					if (echo) {
						claimed.add(echo.key);
						return list;
					}
					return [...list, { key, summary: text, status: 'needs_action', local: true }];
				},
				'add_item',
				{ item: text }
			);
		},
		setStatus(key, next) {
			const item = current(key);
			if (!item?.target) return;
			change(
				item.summary,
				(list) => list.map((entry) => (entry.key === key ? { ...entry, status: next } : entry)),
				'update_item',
				{ item: item.target, status: next }
			);
		},
		rename(key, summary) {
			const item = current(key);
			const text = summary.trim();
			if (!item?.target || !text || text === item.summary) return;
			change(
				item.summary,
				(list) => list.map((entry) => (entry.key === key ? { ...entry, summary: text } : entry)),
				'update_item',
				{ item: item.target, rename: text }
			);
		},
		remove(key) {
			const item = current(key);
			if (!item?.target) return;
			change(item.summary, (list) => list.filter((entry) => entry.key !== key), 'remove_item', {
				item: [item.target]
			});
		},
		removeCompleted() {
			const done = new Set(
				(get(items) ?? []).filter((item) => item.status === 'completed').map((item) => item.key)
			);
			if (!done.size) return;
			change(
				'',
				(list) => list.filter((entry) => !done.has(entry.key)),
				'remove_completed_items',
				{}
			);
		},
		destroy() {
			destroyed = true;
			feed.stop();
			for (const timer of timers) clearTimeout(timer);
			timers.clear();
		}
	};
}
