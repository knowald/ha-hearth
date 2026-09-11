// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './+server';
import { saveYamlDocument } from '$lib/server/persistence';

vi.mock('$lib/server/persistence', () => ({ saveYamlDocument: vi.fn() }));

function post(body: unknown) {
	return POST({
		request: new Request('http://localhost/_api/save_config', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		})
	} as Parameters<typeof POST>[0]) as Promise<Response>;
}

beforeEach(() => vi.clearAllMocks());

describe('application settings save contract', () => {
	it('rejects invalid settings and strips unrecognized fields', async () => {
		expect((await post({ revision: 0, motion: 'false' })).status).toBe(400);
		expect((await post({ revision: 0, locale: '../private' })).status).toBe(400);
		expect(saveYamlDocument).not.toHaveBeenCalled();
		vi.mocked(saveYamlDocument).mockResolvedValueOnce({ conflict: false, revision: 1 });
		expect((await post({ revision: 0, unused_setting: true })).status).toBe(200);
		expect(saveYamlDocument).toHaveBeenCalledWith({
			file: 'data/configuration.yaml',
			body: {},
			revision: 0
		});
	});
	it.each([undefined, -1, '0', 0.5])('rejects revision %s before writing', async (revision) => {
		expect((await post({ revision, locale: 'en' })).status).toBe(400);
		expect(saveYamlDocument).not.toHaveBeenCalled();
	});
	it('returns the saved revision and propagates conflicts', async () => {
		vi.mocked(saveYamlDocument).mockResolvedValueOnce({ conflict: false, revision: 2 });
		expect(await (await post({ revision: 1, locale: 'en' })).json()).toMatchObject({ revision: 2 });
		expect(saveYamlDocument).toHaveBeenCalledWith({
			file: 'data/configuration.yaml',
			body: { locale: 'en' },
			revision: 1
		});
		vi.mocked(saveYamlDocument).mockResolvedValueOnce({ conflict: true, revision: 2 });
		expect((await post({ revision: 1, locale: 'de' })).status).toBe(409);
	});
});
