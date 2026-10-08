// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './+server';
import { updateSettings } from '$lib/agent/documents';

vi.mock('$lib/agent/documents', () => ({ updateSettings: vi.fn() }));

function post(body: unknown, bearer?: string) {
	return POST({
		request: new Request('http://localhost/_api/save_token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}),
		locals: { token: bearer }
	} as Parameters<typeof POST>[0]) as Promise<Response>;
}

beforeEach(() => vi.clearAllMocks());

describe('token save', () => {
	it('stores only the token, when the caller signed in with it', async () => {
		vi.mocked(updateSettings).mockResolvedValueOnce({ saved: true, revision: 5 });
		const response = await post({ token: 'tablet', revision: 4, custom_js: true }, 'tablet');
		expect(await response.json()).toEqual({ action: 'saved', revision: 5 });
		expect(updateSettings).toHaveBeenCalledWith({ token: 'tablet' }, 4);
	});

	it('refuses a token other than the one the caller signed in with', async () => {
		expect((await post({ token: 'someone-else', revision: 4 }, 'tablet')).status).toBe(403);
		expect((await post({ token: 'tablet', revision: 4 })).status).toBe(403);
		expect(updateSettings).not.toHaveBeenCalled();
	});

	it('refuses a missing token or revision and reports conflicts', async () => {
		expect((await post({ revision: 4 }, 'tablet')).status).toBe(400);
		expect((await post({ token: 'tablet' }, 'tablet')).status).toBe(400);
		vi.mocked(updateSettings).mockResolvedValueOnce({ saved: false, conflict: true, revision: 6 });
		const conflict = await post({ token: 'tablet', revision: 4 }, 'tablet');
		expect(conflict.status).toBe(409);
		expect(await conflict.json()).toEqual({ error: 'conflict', revision: 6 });
	});
});
