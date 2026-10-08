// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
	checkToken: vi.fn(async (): Promise<{ status: number; message: string } | undefined> => undefined)
}));
vi.mock('./auth', () => auth);
vi.mock('./documents', () => ({ refreshScreens: vi.fn() }));

import { agentHandler } from './http';

const handle = vi.fn(async () => Response.json({ saved: true }));
const route = agentHandler(handle);

function send(body: object, token: string | undefined = 'token') {
	const request = new Request('http://hearth/_api/agent/dashboard', {
		method: 'PUT',
		body: JSON.stringify(body)
	});
	return route({ request, url: new URL(request.url), locals: { token } as App.Locals });
}

beforeEach(() => {
	vi.clearAllMocks();
	auth.checkToken.mockResolvedValue(undefined);
});

describe('agentHandler', () => {
	it('runs a request without refresh for any authorized caller', async () => {
		expect((await send({ revision: 1 })).status).toBe(200);
		expect(auth.checkToken).not.toHaveBeenCalled();
	});

	it('refuses refresh: true from a regular user before the handler saves anything', async () => {
		auth.checkToken.mockResolvedValue({
			status: 403,
			message: 'This needs a Home Assistant administrator'
		});
		const response = await send({ revision: 1, refresh: true });
		expect(response.status).toBe(403);
		expect((await response.json()).error).toContain('administrator');
		expect(auth.checkToken).toHaveBeenCalledWith('token', 'admin');
		expect(handle).not.toHaveBeenCalled();
	});

	it('runs refresh: true for an administrator', async () => {
		expect((await send({ revision: 1, refresh: true })).status).toBe(200);
		expect(handle).toHaveBeenCalledOnce();
	});
});
