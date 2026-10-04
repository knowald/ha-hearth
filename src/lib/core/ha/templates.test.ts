import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Connection } from 'home-assistant-js-websocket';
import { connection, health } from './connection';
import { watchTemplate, type TemplateRender } from './templates';

interface FakeSubscription {
	template: string;
	push: (event: unknown) => void;
	unsubscribe: ReturnType<typeof vi.fn>;
}

/** A connection whose render_template subscriptions the test drives by hand. */
function fakeConnection(fail?: (template: string) => unknown) {
	const subscriptions: FakeSubscription[] = [];
	const conn = {
		subscribeMessage: vi.fn(
			async (callback: (event: unknown) => void, message: { template: string }) => {
				const failure = fail?.(message.template);
				if (failure) throw failure;
				const unsubscribe = vi.fn();
				subscriptions.push({ template: message.template, push: callback, unsubscribe });
				return unsubscribe;
			}
		)
	};
	return {
		conn: conn as unknown as Connection,
		subscribeMessage: conn.subscribeMessage,
		subscriptions
	};
}

function recorder() {
	const renders: TemplateRender[] = [];
	return { renders, listener: (render: TemplateRender) => renders.push(render) };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const stops: (() => void)[] = [];
function watch(template: string, listener: (render: TemplateRender) => void) {
	const stop = watchTemplate(template, listener);
	stops.push(stop);
	return stop;
}

afterEach(() => {
	for (const stop of stops.splice(0)) stop();
	connection.set(undefined as unknown as Connection);
	health.set('lost');
});

describe('watchTemplate', () => {
	it('shares one subscription per template string and replays the latest render', async () => {
		const fake = fakeConnection();
		connection.set(fake.conn);
		health.set('connected');
		const first = recorder();
		const second = recorder();
		watch('{{ 1 }}', first.listener);
		await flush();
		fake.subscriptions[0].push({ result: 'one' });
		watch('{{ 1 }}', second.listener);
		watch('{{ 2 }}', () => {});
		await flush();

		expect(fake.subscribeMessage).toHaveBeenCalledTimes(2);
		expect(fake.subscribeMessage).toHaveBeenCalledWith(expect.any(Function), {
			type: 'render_template',
			template: '{{ 1 }}'
		});
		expect(first.renders).toEqual([{ status: 'loading' }, { status: 'ready', result: 'one' }]);
		expect(second.renders).toEqual([{ status: 'ready', result: 'one' }]);
	});

	it('unsubscribes when the last listener leaves, and only then', async () => {
		const fake = fakeConnection();
		connection.set(fake.conn);
		health.set('connected');
		const stopFirst = watch('{{ 1 }}', () => {});
		const stopSecond = watch('{{ 1 }}', () => {});
		await flush();

		stopFirst();
		stopFirst();
		await flush();
		expect(fake.subscriptions[0].unsubscribe).not.toHaveBeenCalled();

		stopSecond();
		await flush();
		expect(fake.subscriptions[0].unsubscribe).toHaveBeenCalledTimes(1);

		// a later listener starts a fresh subscription
		watch('{{ 1 }}', () => {});
		await flush();
		expect(fake.subscribeMessage).toHaveBeenCalledTimes(2);
	});

	it('waits for the socket before subscribing', async () => {
		const fake = fakeConnection();
		const { renders, listener } = recorder();
		watch('{{ 1 }}', listener);
		connection.set(fake.conn);
		await flush();
		expect(fake.subscribeMessage).not.toHaveBeenCalled();
		expect(renders).toEqual([{ status: 'loading' }]);

		health.set('connected');
		await flush();
		expect(fake.subscribeMessage).toHaveBeenCalledTimes(1);
	});

	it('reports a template Home Assistant rejects and retries it on the next connection', async () => {
		const fake = fakeConnection(() => ({ code: 'template_error', message: 'UndefinedError: x' }));
		connection.set(fake.conn);
		health.set('connected');
		const { renders, listener } = recorder();
		watch('{{ x.y }}', listener);
		await flush();
		expect(renders.at(-1)).toEqual({ status: 'error', error: 'UndefinedError: x' });

		// a second surface showing the same template does not ask again
		watch('{{ x.y }}', () => {});
		await flush();
		expect(fake.subscribeMessage).toHaveBeenCalledTimes(1);

		health.set('lost');
		health.set('connected');
		await flush();
		expect(fake.subscribeMessage).toHaveBeenCalledTimes(2);
	});

	it('reports errors Home Assistant pushes on a live subscription', async () => {
		const fake = fakeConnection();
		connection.set(fake.conn);
		health.set('connected');
		const { renders, listener } = recorder();
		watch('{{ 1 }}', listener);
		await flush();
		fake.subscriptions[0].push({ error: 'TypeError: bad', level: 'ERROR' });
		fake.subscriptions[0].push({ result: 'fine again' });
		expect(renders.slice(1)).toEqual([
			{ status: 'error', error: 'TypeError: bad' },
			{ status: 'ready', result: 'fine again' }
		]);
	});

	it('turns parsed results back into text', async () => {
		const fake = fakeConnection();
		connection.set(fake.conn);
		health.set('connected');
		const { renders, listener } = recorder();
		watch('{{ 21 }}', listener);
		await flush();
		fake.subscriptions[0].push({ result: 21.5 });
		fake.subscriptions[0].push({ result: true });
		fake.subscriptions[0].push({ result: [1, 2] });
		expect(renders.slice(1).map((render) => render.status === 'ready' && render.result)).toEqual([
			'21.5',
			'true',
			'[1,2]'
		]);
	});

	it('keeps a subscription across a socket drop and moves to a new connection', async () => {
		const first = fakeConnection();
		connection.set(first.conn);
		health.set('connected');
		const { renders, listener } = recorder();
		watch('{{ 1 }}', listener);
		await flush();
		first.subscriptions[0].push({ result: 'before' });

		// the library re-sends live subscriptions after a drop by itself
		health.set('lost');
		health.set('connected');
		await flush();
		expect(first.subscribeMessage).toHaveBeenCalledTimes(1);

		const second = fakeConnection();
		connection.set(second.conn);
		await flush();
		expect(first.subscriptions[0].unsubscribe).toHaveBeenCalledTimes(1);
		expect(second.subscribeMessage).toHaveBeenCalledTimes(1);
		// the old connection's late events no longer reach listeners
		first.subscriptions[0].push({ result: 'stale' });
		second.subscriptions[0].push({ result: 'after' });
		expect(renders.map((render) => render.status === 'ready' && render.result)).toEqual([
			false,
			'before',
			'after'
		]);
	});
});
