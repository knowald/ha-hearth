// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const documents = vi.hoisted(() => ({
	readDashboard: vi.fn(async () => ({ revision: 3, yaml: 'revision: 3\nversion: 5\n' })),
	saveDashboard: vi.fn(),
	prepareDashboard: vi.fn(() => ({ issues: ['rooms must be a list'] })),
	readSettings: vi.fn(),
	updateSettings: vi.fn(),
	readCustomCss: vi.fn(),
	saveCustomCss: vi.fn(),
	listVersions: vi.fn(),
	readVersion: vi.fn(async () => undefined),
	refreshScreens: vi.fn(async () => undefined)
}));
vi.mock('./documents', () => documents);
const auth = vi.hoisted(() => ({
	checkToken: vi.fn(async (): Promise<{ status: number; message: string } | undefined> => undefined)
}));
vi.mock('./auth', () => auth);

import { handleMcp, transportIssue } from './mcp';

async function rpc(payload: unknown) {
	const response = await handleMcp(
		new Request('http://hearth/_api/mcp', { method: 'POST', body: JSON.stringify(payload) }),
		'token'
	);
	return { status: response.status, body: response.status === 202 ? null : await response.json() };
}

const call = (name: string, args: Record<string, unknown> = {}) =>
	rpc({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });

beforeEach(() => {
	vi.clearAllMocks();
	auth.checkToken.mockResolvedValue(undefined);
});

describe('handleMcp', () => {
	it('initializes with the version the client asked for when it supports it', async () => {
		const { body } = await rpc({
			jsonrpc: '2.0',
			id: 0,
			method: 'initialize',
			params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't' } }
		});
		expect(body.result.protocolVersion).toBe('2025-03-26');
		expect(body.result.capabilities).toHaveProperty('tools');
		expect(body.result.instructions).toContain('save_dashboard');
	});

	it('accepts notifications without a body', async () => {
		expect(await rpc({ jsonrpc: '2.0', method: 'notifications/initialized' })).toEqual({
			status: 202,
			body: null
		});
	});

	it('lists tools without their implementation', async () => {
		const { body } = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
		const names = body.result.tools.map(({ name }: { name: string }) => name);
		expect(names).toEqual(
			expect.arrayContaining(['get_dashboard', 'save_dashboard', 'get_schema'])
		);
		expect(body.result.tools[0]).not.toHaveProperty('run');
	});

	it('returns the dashboard YAML', async () => {
		const { body } = await call('get_dashboard');
		expect(body.result.content[0].text).toBe('revision: 3\nversion: 5\n');
	});

	it('reports validation issues as a tool error the agent can act on', async () => {
		documents.saveDashboard.mockResolvedValue({ saved: false, issues: ['rooms must be a list'] });
		const { body } = await call('save_dashboard', { revision: 3, yaml: 'version: 5' });
		expect(body.result.isError).toBe(true);
		expect(body.result.content[0].text).toContain('rooms must be a list');
	});

	it('reports a conflict with the revision to read again', async () => {
		documents.saveDashboard.mockResolvedValue({ saved: false, conflict: true, revision: 7 });
		const { body } = await call('save_dashboard', { revision: 3, yaml: 'version: 5' });
		expect(body.result.content[0].text).toContain('revision 7');
	});

	it('refreshes the screens after a save when asked', async () => {
		documents.saveDashboard.mockResolvedValue({ saved: true, revision: 4 });
		const { body } = await call('save_dashboard', { revision: 3, yaml: 'x: 1', refresh: true });
		expect(JSON.parse(body.result.content[0].text)).toEqual({
			saved: true,
			revision: 4,
			refreshed: true
		});
		expect(documents.refreshScreens).toHaveBeenCalledWith('token');
	});

	it('refuses a save without a revision', async () => {
		const { body } = await call('save_dashboard', { yaml: 'x: 1' });
		expect(body.result.isError).toBe(true);
		expect(documents.saveDashboard).not.toHaveBeenCalled();
	});

	it('serves one type of the schema and refuses an unknown one', async () => {
		const known = await call('get_schema', { card: 'scenes' });
		expect(JSON.parse(known.body.result.content[0].text).properties).toHaveProperty('scenes');
		const unknown = await call('get_schema', { widget: 'no_such_widget' });
		expect(unknown.body.result.isError).toBe(true);
	});

	it('answers unknown methods and tools with JSON-RPC errors', async () => {
		expect((await rpc({ jsonrpc: '2.0', id: 5, method: 'resources/list' })).body.error.code).toBe(
			-32601
		);
		expect((await call('format_disk')).body.error.code).toBe(-32602);
	});

	it('answers a batch in order', async () => {
		const { body } = await rpc([
			{ jsonrpc: '2.0', id: 'a', method: 'ping' },
			{ jsonrpc: '2.0', method: 'notifications/initialized' },
			{ jsonrpc: '2.0', id: 'b', method: 'ping' }
		]);
		expect(body.map(({ id }: { id: string }) => id)).toEqual(['a', 'b']);
	});

	it('refuses a CSS save without css instead of emptying the file', async () => {
		const { body } = await call('save_custom_css', {});
		expect(body.result.isError).toBe(true);
		expect(documents.saveCustomCss).not.toHaveBeenCalled();
	});

	it('reports a failed refresh after a CSS save as saved', async () => {
		documents.refreshScreens.mockRejectedValueOnce(new Error('not an administrator'));
		const { body } = await call('save_custom_css', { css: 'a {}', refresh: true });
		expect(body.result.isError).toBeUndefined();
		expect(JSON.parse(body.result.content[0].text)).toEqual({
			saved: true,
			refreshed: false,
			refresh_error: 'not an administrator'
		});
	});

	it('refuses a dashboard save whose yaml is not text', async () => {
		const { body } = await call('save_dashboard', { revision: 3 });
		expect(body.result.isError).toBe(true);
		expect(documents.saveDashboard).not.toHaveBeenCalled();
	});

	it('answers params and arguments that are not objects with JSON-RPC errors', async () => {
		for (const method of ['initialize', 'tools/call']) {
			const { status, body } = await rpc({ jsonrpc: '2.0', id: 9, method, params: null });
			expect(status).toBe(200);
			expect(body.error.code).toBe(-32602);
		}
		const { body } = await rpc({
			jsonrpc: '2.0',
			id: 9,
			method: 'tools/call',
			params: { name: 'get_dashboard', arguments: 'all' }
		});
		expect(body.error.code).toBe(-32602);
	});

	it('answers the rest of a batch when one message fails', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		documents.readSettings.mockImplementationOnce(() => {
			throw new Error('disk gone');
		});
		const { body } = await rpc([
			{ jsonrpc: '2.0', id: 'a', method: 'tools/call', params: { name: 'get_settings' } },
			{ jsonrpc: '2.0', id: 'b', method: 'ping' }
		]);
		expect(body.map(({ id }: { id: string }) => id)).toEqual(['a', 'b']);
		expect(body[1].result).toEqual({});
	});

	it('refuses an id that is not a string, number or null', async () => {
		const { body } = await rpc({ jsonrpc: '2.0', id: { nested: 1 }, method: 'ping' });
		expect(body).toMatchObject({ id: null, error: { code: -32600 } });
	});

	it('needs an administrator for settings and custom CSS, not for the dashboard', async () => {
		auth.checkToken.mockResolvedValue({
			status: 403,
			message: 'This needs a Home Assistant administrator'
		});
		for (const [name, args] of [
			['update_settings', { revision: 1, locale: 'de' }],
			['save_custom_css', { css: 'a {}' }]
		] as const) {
			const { body } = await call(name, args);
			expect(body.result).toMatchObject({ isError: true });
			expect(body.result.content[0].text).toContain('administrator');
		}
		expect(documents.updateSettings).not.toHaveBeenCalled();
		expect(documents.saveCustomCss).not.toHaveBeenCalled();
		expect(auth.checkToken).toHaveBeenCalledWith('token', 'admin');

		documents.saveDashboard.mockResolvedValue({ saved: true, revision: 4 });
		const { body } = await call('save_dashboard', { revision: 3, yaml: 'x: 1' });
		expect(body.result.isError).toBeUndefined();
	});

	it('refuses an empty batch', async () => {
		expect((await rpc([])).body.error.code).toBe(-32600);
	});
});

describe('transportIssue', () => {
	const request = (headers: Record<string, string>) =>
		new Request('http://hearth.local:8099/_api/mcp', { method: 'POST', headers });

	afterEach(() => vi.unstubAllEnvs());

	it('lets clients without an Origin through', () => {
		expect(transportIssue(request({}))).toBeUndefined();
	});

	it('allows the request origin and the public Home Assistant origin', () => {
		vi.stubEnv('HASS_PUBLIC_URL', 'https://home.example.com/');
		expect(transportIssue(request({ origin: 'http://hearth.local:8099' }))).toBeUndefined();
		expect(transportIssue(request({ origin: 'https://home.example.com' }))).toBeUndefined();
	});

	it('refuses other origins by scheme, host and port, and malformed ones', () => {
		for (const origin of [
			'http://hearth.local:8080',
			'https://hearth.local:8099',
			'http://evil.example',
			'null',
			'not a url'
		]) {
			expect(transportIssue(request({ origin }))?.status).toBe(403);
		}
	});

	it('refuses a protocol version Hearth does not speak', () => {
		expect(transportIssue(request({ 'mcp-protocol-version': '2025-06-18' }))).toBeUndefined();
		expect(transportIssue(request({ 'mcp-protocol-version': '1999-01-01' }))?.status).toBe(400);
	});
});
