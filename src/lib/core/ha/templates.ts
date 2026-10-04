import { get } from 'svelte/store';
import type { Connection } from 'home-assistant-js-websocket';
import { connected, connection } from './connection';

/*
 * Shared Home Assistant template renders: one render_template subscription
 * per distinct template string, however many surfaces show it, dropped with
 * the last one. The library re-sends live subscriptions itself after a socket
 * drop, so only a new Connection (another server or token) and templates
 * waiting for the socket are subscribed again from here.
 */

export type TemplateRender =
	{ status: 'loading' } | { status: 'ready'; result: string } | { status: 'error'; error: string };

type Listener = (render: TemplateRender) => void;

interface Shared {
	listeners: Set<Listener>;
	render: TemplateRender;
	/** The connection the subscription runs on; unset while none is live. */
	on?: Connection;
	stop?: Promise<(() => void) | undefined>;
}

const shared = new Map<string, Shared>();
let stopWatchingConnection: (() => void) | undefined;

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

function start(template: string, entry: Shared) {
	const conn = get(connection);
	if (!conn || !get(connected)) return;
	entry.on = conn;
	entry.stop = conn
		.subscribeMessage<{ result?: unknown; error?: unknown }>(
			(response) => {
				if (entry.on !== conn) return;
				if (typeof response?.error === 'string') {
					publish(entry, { status: 'error', error: response.error });
				} else if (response && 'result' in response) {
					publish(entry, { status: 'ready', result: resultText(response.result) });
				}
			},
			{ type: 'render_template', template }
		)
		.catch((failure: { message?: unknown }) => {
			if (entry.on !== conn) return undefined;
			entry.on = undefined;
			entry.stop = undefined;
			const error = typeof failure?.message === 'string' ? failure.message : 'template_error';
			publish(entry, { status: 'error', error });
			return undefined;
		});
}

function halt(entry: Shared) {
	const stop = entry.stop;
	entry.on = undefined;
	entry.stop = undefined;
	void stop?.then((unsubscribe) => unsubscribe?.()).catch(() => {});
}

function sync() {
	const conn = get(connection);
	const live = get(connected);
	for (const [template, entry] of shared) {
		if (entry.on && entry.on !== conn) halt(entry);
		if (!entry.on && conn && live) start(template, entry);
	}
}

function watchConnection(): () => void {
	const stopConnection = connection.subscribe(sync);
	const stopConnected = connected.subscribe(sync);
	return () => {
		stopConnection();
		stopConnected();
	};
}

/**
 * Calls `listener` with the current render of `template` straight away and
 * again on every change. Returns the function that stops listening.
 */
export function watchTemplate(template: string, listener: Listener): () => void {
	let entry = shared.get(template);
	const created = !entry;
	if (!entry) {
		entry = { listeners: new Set(), render: { status: 'loading' } };
		shared.set(template, entry);
	}
	const current = entry;
	current.listeners.add(listener);
	listener(current.render);
	if (!stopWatchingConnection) stopWatchingConnection = watchConnection();
	// a template that failed waits for the next connection instead of
	// retrying on every new listener
	else if (created) start(template, current);

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
