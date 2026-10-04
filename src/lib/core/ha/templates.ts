import { get } from 'svelte/store';
import type { Connection } from 'home-assistant-js-websocket';
import { connection, health, type ConnectionHealth } from './connection';

/*
 * Shared Home Assistant template renders: one render_template subscription
 * per distinct template string, however many surfaces show it, dropped with
 * the last one. Subscriptions are made here, not re-sent by the library after
 * a socket drop: the library would keep re-sending one per drop even after
 * its last listener left, so a dropped socket forgets them all and the next
 * live one subscribes afresh.
 */

export type TemplateRender =
	{ status: 'loading' } | { status: 'ready'; result: string } | { status: 'error'; error: string };

type Listener = (render: TemplateRender) => void;

/** One subscription on one connection; events from an older run are ignored. */
interface Run {
	conn: Connection;
	stop: Promise<(() => void) | undefined>;
}

interface Shared {
	listeners: Set<Listener>;
	render: TemplateRender;
	run?: Run;
	/** Home Assistant refused the template; it is asked again once the connection changes. */
	failed?: boolean;
}

const shared = new Map<string, Shared>();
let stopWatchingConnection: (() => void) | undefined;
let lastConnection: Connection | undefined;

// a degraded socket is open, only some other subscription failed
function isLive(state: ConnectionHealth) {
	return state === 'connected' || state === 'degraded';
}

// templates render to text, but Home Assistant parses results that look like
// numbers, lists or mappings into those types before sending them
function resultText(result: unknown): string {
	if (typeof result === 'string') return result;
	if (result === null || result === undefined) return '';
	return typeof result === 'object' ? JSON.stringify(result) : String(result);
}

function publish(entry: Shared, render: TemplateRender) {
	entry.render = render;
	for (const listener of [...entry.listeners]) listener(render);
}

function start(template: string, entry: Shared, conn: Connection) {
	const run: Run = {
		conn,
		stop: conn
			.subscribeMessage<{ result?: unknown; error?: unknown; level?: unknown }>(
				(response) => {
					if (entry.run !== run) return;
					if (typeof response?.error === 'string') {
						// warnings (a deprecated filter, say) still come with a result
						if (response.level !== 'WARNING') {
							publish(entry, { status: 'error', error: response.error });
						}
					} else if (response && 'result' in response) {
						publish(entry, { status: 'ready', result: resultText(response.result) });
					}
				},
				// without report_errors Home Assistant only logs a broken template
				{ type: 'render_template', template, report_errors: true },
				{ resubscribe: false }
			)
			.catch((failure: { message?: unknown }) => {
				if (entry.run !== run) return undefined;
				entry.run = undefined;
				entry.failed = true;
				const error = typeof failure?.message === 'string' ? failure.message : 'template_error';
				publish(entry, { status: 'error', error });
				return undefined;
			})
	};
	entry.run = run;
}

function halt(entry: Shared) {
	const stop = entry.run?.stop;
	entry.run = undefined;
	void stop?.then((unsubscribe) => unsubscribe?.()).catch(() => {});
}

function sync() {
	const conn = get(connection);
	const live = Boolean(conn) && isLive(get(health));
	const replaced = conn !== lastConnection;
	lastConnection = conn;
	for (const [template, entry] of shared) {
		if (entry.run && entry.run.conn !== conn) halt(entry);
		if (!live) {
			// the socket is gone and its subscriptions with it: nothing to unsubscribe
			entry.run = undefined;
			entry.failed = false;
		} else {
			if (replaced) entry.failed = false;
			if (!entry.run && !entry.failed && conn) start(template, entry, conn);
		}
	}
}

function watchConnection(): () => void {
	lastConnection = get(connection);
	const stopConnection = connection.subscribe(sync);
	const stopHealth = health.subscribe(sync);
	return () => {
		stopConnection();
		stopHealth();
	};
}

/**
 * Calls `listener` with the current render of `template` straight away and
 * again on every change. Returns the function that stops listening.
 */
export function watchTemplate(template: string, listener: Listener): () => void {
	let entry = shared.get(template);
	if (!entry) {
		entry = { listeners: new Set(), render: { status: 'loading' } };
		shared.set(template, entry);
	}
	const current = entry;
	current.listeners.add(listener);
	listener(current.render);
	if (!stopWatchingConnection) stopWatchingConnection = watchConnection();
	else sync();

	let released = false;
	return () => {
		if (released) return;
		released = true;
		current.listeners.delete(listener);
		if (current.listeners.size) return;
		halt(current);
		shared.delete(template);
		if (!shared.size) {
			stopWatchingConnection?.();
			stopWatchingConnection = undefined;
		}
	};
}
