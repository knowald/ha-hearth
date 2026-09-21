// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const persistence = vi.hoisted(() => ({
	currentRevision: vi.fn(async () => 4),
	listBackups: vi.fn(async () => [{ name: 'hearth-10-r3.yaml', at: 10, revision: 3, size: 20 }]),
	readBackup: vi.fn(async (_file: string, name: string) =>
		name === 'hearth-10-r3.yaml' ? 'rooms: []\n' : undefined
	)
}));
const live = vi.hoisted(() => ({ read: vi.fn(async () => 'revision: 4\n') }));

vi.mock('$lib/server/persistence', () => persistence);
vi.mock('fs/promises', () => ({ readFile: live.read }));

import { GET } from './+server';

function get(query = '') {
	return GET({
		url: new URL(`http://localhost/_api/hearth_versions${query}`),
		setHeaders: () => undefined
	} as any) as Promise<Response>;
}

describe('Hearth versions endpoint', () => {
	beforeEach(() => {
		live.read.mockClear();
	});

	it('lists the backups with the revision the file is on', async () => {
		const body = await (await get()).json();
		expect(body.revision).toBe(4);
		expect(body.versions).toEqual([{ name: 'hearth-10-r3.yaml', at: 10, revision: 3, size: 20 }]);
	});

	it('returns one backup by name', async () => {
		const body = await (await get('?name=hearth-10-r3.yaml')).json();
		expect(body).toEqual({ name: 'hearth-10-r3.yaml', content: 'rooms: []\n' });
	});

	it('refuses a name the listing does not hold', async () => {
		await expect(get('?name=../configuration.yaml')).rejects.toMatchObject({ status: 404 });
	});

	it('serves the live document under the current name', async () => {
		const body = await (await get('?name=current')).json();
		expect(body.content).toBe('revision: 4\n');
		expect(persistence.readBackup).not.toHaveBeenCalledWith(expect.anything(), 'current');
	});

	it('reports an empty document when the file is missing', async () => {
		live.read.mockRejectedValueOnce(Object.assign(new Error('missing'), { code: 'ENOENT' }));
		const body = await (await get('?name=current')).json();
		expect(body.content).toBe('');
	});
});
