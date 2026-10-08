// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const persistence = vi.hoisted(() => ({
	text: '' as string | undefined,
	readDocument: vi.fn(async () => persistence.text),
	saveYamlDocument: vi.fn(async ({ revision }: { revision: number }) => ({
		conflict: false,
		revision: revision + 1
	})),
	currentRevision: vi.fn(),
	listBackups: vi.fn(),
	readBackup: vi.fn()
}));
vi.mock('$lib/server/persistence', () => persistence);

import { prepareDashboard, readSettings, updateSettings } from './documents';

beforeEach(() => {
	vi.clearAllMocks();
	persistence.text = 'revision: 2\nlocale: de\ntoken: secret\nmotion: true\n';
});

describe('settings', () => {
	it('reports whether a token is stored without showing it', async () => {
		expect(await readSettings()).toEqual({
			revision: 2,
			locale: 'de',
			motion: true,
			token_set: true
		});
	});

	it('changes the given fields, clears the null ones and keeps the rest', async () => {
		expect(await updateSettings({ locale: 'fr', motion: null }, 2)).toEqual({
			saved: true,
			revision: 3
		});
		expect(persistence.saveYamlDocument).toHaveBeenCalledWith(
			expect.objectContaining({ body: { locale: 'fr', token: 'secret' }, revision: 2 })
		);
	});

	it('refuses unknown fields and invalid values', async () => {
		expect(await updateSettings({ colour: 'red' }, 2)).toEqual({
			saved: false,
			issues: ['unknown settings: colour']
		});
		const invalid = await updateSettings({ motion: 'yes' }, 2);
		expect(invalid.saved).toBe(false);
		expect(persistence.saveYamlDocument).not.toHaveBeenCalled();
	});
});

describe('prepareDashboard', () => {
	it('reports YAML that does not parse', () => {
		expect(prepareDashboard({ yaml: 'rooms: [' })).toEqual({
			issues: [expect.stringMatching(/^YAML does not parse/)]
		});
	});

	it('refuses another document version', () => {
		expect(prepareDashboard({ yaml: 'version: 4\nrooms: []\nrail: []' })).toEqual({
			issues: [expect.stringContaining('version 4')]
		});
	});

	it('accepts a minimal dashboard', () => {
		expect(prepareDashboard({ yaml: 'version: 5\nrooms: []\nrail: []' })).toEqual({
			config: { version: 5, rooms: [], rail: [] }
		});
	});
});
