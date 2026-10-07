// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authorize, checkToken } from './auth';

const fetchMock = vi.fn();

/** Answers the websocket handshake and auth/current_user the way Home Assistant does. */
let currentUser: { is_admin: boolean } | 'refuse' | 'unreachable';
const sockets: string[] = [];
class FakeSocket extends EventTarget {
	constructor(url: string) {
		super();
		sockets.push(url);
		queueMicrotask(() => {
			if (currentUser === 'unreachable') this.dispatchEvent(new Event('error'));
			else this.receive({ type: 'auth_required' });
		});
	}
	receive(message: object) {
		this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) }));
	}
	send(raw: string) {
		const message = JSON.parse(raw);
		queueMicrotask(() => {
			if (message.type === 'auth') {
				this.receive({ type: currentUser === 'refuse' ? 'auth_invalid' : 'auth_ok' });
			} else if (message.type === 'auth/current_user') {
				this.receive({ id: message.id, type: 'result', success: true, result: currentUser });
			}
		});
	}
	close() {}
}

beforeEach(() => {
	vi.stubEnv('HASS_URL', 'http://homeassistant:8123');
	vi.stubGlobal('fetch', fetchMock);
	vi.stubGlobal('WebSocket', FakeSocket);
	fetchMock.mockReset();
	fetchMock.mockResolvedValue(new Response('{"message":"API running."}'));
	currentUser = { is_admin: true };
	sockets.length = 0;
});
afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

function request(token?: string) {
	return new Request('http://hearth/_api/mcp', {
		headers: token ? { Authorization: `Bearer ${token}` } : {}
	});
}

describe('authorize', () => {
	it('refuses a request without a bearer token and asks for one', async () => {
		const result = await authorize(request());
		expect(result).toBeInstanceOf(Response);
		expect((result as Response).status).toBe(401);
		expect((result as Response).headers.get('WWW-Authenticate')).toMatch(/^Bearer/);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('accepts a token Home Assistant accepts and remembers it', async () => {
		fetchMock.mockResolvedValue(new Response('{"message":"API running."}'));
		expect(await authorize(request('good'))).toEqual({ token: 'good' });
		expect(await authorize(request('good'))).toEqual({ token: 'good' });
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledWith(
			'http://homeassistant:8123/api/',
			expect.objectContaining({ headers: { Authorization: 'Bearer good' } })
		);
	});

	it('refuses a token Home Assistant refuses', async () => {
		fetchMock.mockResolvedValue(new Response('', { status: 401 }));
		const result = (await authorize(request('bad'))) as Response;
		expect(result.status).toBe(401);
	});

	it('answers 503 when Home Assistant cannot be reached', async () => {
		fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
		expect(((await authorize(request('unknown'))) as Response).status).toBe(503);
	});
});

describe('checkToken for administrators', () => {
	it('asks auth/current_user over the websocket API and remembers the answer', async () => {
		expect(await checkToken('admin-token', 'admin')).toBeUndefined();
		expect(await checkToken('admin-token', 'admin')).toBeUndefined();
		expect(sockets).toEqual(['ws://homeassistant:8123/api/websocket']);
	});

	it('refuses a user who is not an administrator with 403', async () => {
		currentUser = { is_admin: false };
		expect(await checkToken('user-token', 'admin')).toMatchObject({ status: 403 });
		expect(await checkToken('user-token', 'user')).toBeUndefined();
	});

	it('answers 503 when the websocket API refuses or cannot be reached', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		currentUser = 'refuse';
		expect(await checkToken('odd-token', 'admin')).toMatchObject({ status: 503 });
		currentUser = 'unreachable';
		expect(await checkToken('lost-token', 'admin')).toMatchObject({ status: 503 });
	});

	it('does not ask who a token Home Assistant refuses belongs to', async () => {
		fetchMock.mockResolvedValue(new Response('', { status: 401 }));
		expect(await checkToken('bad-admin', 'admin')).toMatchObject({ status: 401 });
		expect(sockets).toEqual([]);
	});
});
