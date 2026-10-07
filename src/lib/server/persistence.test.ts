// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import {
	currentRevision,
	listBackups,
	readBackup,
	readDocument,
	saveYamlDocument
} from './persistence';

let directory: string;
let file: string;

beforeEach(async () => {
	directory = await mkdtemp(join(tmpdir(), 'hearth-persistence-'));
	file = join(directory, 'hearth.yaml');
});

afterEach(async () => {
	await rm(directory, { recursive: true, force: true });
});

const backups = async (name = 'hearth.yaml') =>
	(await readdir(join(directory, 'backups', name)).catch(() => [])).sort();

describe('saveYamlDocument', () => {
	it('writes the document with server-owned keys first and no backup on the first save', async () => {
		const result = await saveYamlDocument({
			file,
			body: { rooms: [], version: 99, revision: 5 },
			revision: 0,
			head: { version: 4 }
		});
		expect(result).toEqual({ conflict: false, revision: 1 });
		expect(await readFile(file, 'utf8')).toBe('revision: 1\nversion: 4\nrooms: []\n');
		expect(await backups()).toEqual([]);
	});

	it('backs up the replaced document under a name that carries its revision', async () => {
		await saveYamlDocument({ file, body: { name: 'one' }, revision: 0 });
		await saveYamlDocument({ file, body: { name: 'two' }, revision: 1 });
		const names = await backups();
		expect(names).toHaveLength(1);
		expect(names[0]).toMatch(/^hearth-\d+-r1\.yaml$/);
		expect(await readFile(join(directory, 'backups', 'hearth.yaml', names[0]), 'utf8')).toContain(
			'name: one'
		);
	});

	it('serializes concurrent saves so every accepted one leaves its own backup', async () => {
		await saveYamlDocument({ file, body: { name: 'base' }, revision: 0 });
		const results = await Promise.all(
			[1, 2, 3].map((step) =>
				saveYamlDocument({ file, body: { name: `step ${step}` }, revision: 0, force: true })
			)
		);
		expect(results.map(({ revision }) => revision).sort()).toEqual([2, 3, 4]);
		expect((await backups()).map((name) => name.replace(/-\d+-/, '-'))).toEqual([
			'hearth-r1.yaml',
			'hearth-r2.yaml',
			'hearth-r3.yaml'
		]);
	});

	it('serializes saves that spell the same file differently', async () => {
		await saveYamlDocument({ file, body: { name: 'base' }, revision: 0 });
		const results = await Promise.all(
			[file, relative(process.cwd(), file)].map((spelling) =>
				saveYamlDocument({ file: spelling, body: { name: spelling }, revision: 1 })
			)
		);
		expect(results.map(({ conflict }) => conflict).sort()).toEqual([false, true]);
	});

	it('keeps documents with the same stem apart', async () => {
		const sibling = join(directory, 'hearth.yml');
		await saveYamlDocument({ file, body: { name: 'yaml one' }, revision: 0 });
		await saveYamlDocument({ file, body: { name: 'yaml two' }, revision: 1 });
		await saveYamlDocument({ file: sibling, body: { name: 'yml one' }, revision: 0 });
		await saveYamlDocument({ file: sibling, body: { name: 'yml two' }, revision: 1 });
		expect(await backups('hearth.yaml')).toHaveLength(1);
		expect(await backups('hearth.yml')).toHaveLength(1);
	});

	it('keeps the ten newest backups', async () => {
		for (let step = 0; step <= 12; step += 1) {
			await saveYamlDocument({ file, body: { step }, revision: 0, force: true });
		}
		const names = await backups();
		expect(names).toHaveLength(10);
		expect(names.map((name) => name.replace(/^hearth-\d+-/, ''))).not.toContain('r1.yaml');
		expect(names.map((name) => name.replace(/^hearth-\d+-/, ''))).toContain('r12.yaml');
	});

	it('refuses a stale revision and keeps the file as it was', async () => {
		await saveYamlDocument({ file, body: { name: 'one' }, revision: 0 });
		const result = await saveYamlDocument({ file, body: { name: 'stale' }, revision: 0 });
		expect(result).toEqual({ conflict: true, revision: 1 });
		expect(await readFile(file, 'utf8')).toContain('name: one');
	});

	it('aborts the save when the backup cannot be written', async () => {
		await saveYamlDocument({ file, body: { name: 'one' }, revision: 0 });
		// a file where the backup directory should be makes mkdir fail
		await rm(join(directory, 'backups'), { recursive: true, force: true });
		await writeFile(join(directory, 'backups'), 'not a directory');
		await expect(saveYamlDocument({ file, body: { name: 'two' }, revision: 1 })).rejects.toThrow(
			/Could not back up/
		);
		expect(await readFile(file, 'utf8')).toContain('name: one');
	});

	it('refuses to replace a document it cannot read', async () => {
		await writeFile(file, 'rooms: [unterminated');
		await expect(saveYamlDocument({ file, body: { name: 'two' }, revision: 0 })).rejects.toThrow();
		expect(await readFile(file, 'utf8')).toBe('rooms: [unterminated');
		expect(await readdir(directory)).toEqual(['hearth.yaml']);
	});
});

describe('outside edits', () => {
	it('takes a file Hearth never wrote as it is', async () => {
		await writeFile(file, 'revision: 3\nrooms: []\n');
		expect(await currentRevision(file)).toBe(3);
		expect(await readFile(file, 'utf8')).toBe('revision: 3\nrooms: []\n');
		expect(await backups()).toEqual([]);
	});

	it('adopts an edit made outside Hearth as the next revision and backs up what Hearth wrote', async () => {
		await saveYamlDocument({ file, body: { name: 'hearth' }, revision: 0 });
		await writeFile(file, '# edited by hand\nrevision: 1\nname: outside\n');
		expect(await readDocument(file)).toBe('# edited by hand\nrevision: 2\nname: outside\n');
		const names = await backups();
		expect(names).toHaveLength(1);
		expect(names[0]).toMatch(/-r1\.yaml$/);
		expect(await readFile(join(directory, 'backups', 'hearth.yaml', names[0]), 'utf8')).toContain(
			'name: hearth'
		);
		// reading again finds nothing new
		expect(await currentRevision(file)).toBe(2);
		expect(await backups()).toHaveLength(1);
	});

	it('makes a save from before the outside edit conflict', async () => {
		await saveYamlDocument({ file, body: { name: 'hearth' }, revision: 0 });
		await writeFile(file, 'revision: 1\nname: outside\n');
		expect(await saveYamlDocument({ file, body: { name: 'stale' }, revision: 1 })).toEqual({
			conflict: true,
			revision: 2
		});
		expect(await readFile(file, 'utf8')).toContain('name: outside');
	});

	it('adds a revision to an outside edit that dropped it', async () => {
		await saveYamlDocument({ file, body: { name: 'hearth' }, revision: 0 });
		await saveYamlDocument({ file, body: { name: 'hearth' }, revision: 1 });
		await writeFile(file, 'name: outside\n');
		expect(await readDocument(file)).toBe('revision: 3\nname: outside\n');
	});

	it('rewrites a document whose header defeats the line edit', async () => {
		await saveYamlDocument({ file, body: { name: 'hearth' }, revision: 0 });
		await writeFile(file, '---\nname: outside\n');
		expect(await currentRevision(file)).toBe(2);
		expect(await readFile(file, 'utf8')).toContain('name: outside');
	});

	it('leaves an outside edit that does not parse for the load error and adopts it once fixed', async () => {
		await saveYamlDocument({ file, body: { name: 'hearth' }, revision: 0 });
		await writeFile(file, 'rooms: [unterminated');
		expect(await readDocument(file)).toBe('rooms: [unterminated');
		await writeFile(file, 'revision: 1\nrooms: []\n');
		expect(await currentRevision(file)).toBe(2);
	});
});

describe('listBackups', () => {
	it('lists nothing for a document that has never been replaced', async () => {
		expect(await listBackups(file)).toEqual([]);
		await saveYamlDocument({ file, body: { name: 'one' }, revision: 0 });
		expect(await listBackups(file)).toEqual([]);
	});

	it('reports each backup newest first, with the revision it holds', async () => {
		await saveYamlDocument({ file, body: { name: 'one' }, revision: 0 });
		await saveYamlDocument({ file, body: { name: 'two' }, revision: 1 });
		await saveYamlDocument({ file, body: { name: 'three' }, revision: 2 });
		const entries = await listBackups(file);
		expect(entries.map((entry) => entry.revision)).toEqual([2, 1]);
		expect(entries[0].size).toBeGreaterThan(0);
		expect(entries[0].at).toBeGreaterThan(0);
	});

	it('leaves the backups of another document out', async () => {
		const sibling = join(directory, 'hearth.yml');
		await saveYamlDocument({ file, body: { name: 'one' }, revision: 0 });
		await saveYamlDocument({ file, body: { name: 'two' }, revision: 1 });
		await saveYamlDocument({ file: sibling, body: { name: 'a' }, revision: 0 });
		await saveYamlDocument({ file: sibling, body: { name: 'b' }, revision: 1 });
		expect(await listBackups(file)).toHaveLength(1);
		expect((await listBackups(file))[0].name).toMatch(/^hearth-\d+-r1\.yaml$/);
	});
});

describe('readBackup', () => {
	it('returns the text the backup holds', async () => {
		await saveYamlDocument({ file, body: { name: 'one' }, revision: 0 });
		await saveYamlDocument({ file, body: { name: 'two' }, revision: 1 });
		const [entry] = await listBackups(file);
		expect(await readBackup(file, entry.name)).toContain('name: one');
	});

	it('reads nothing outside the backup directory', async () => {
		await saveYamlDocument({ file, body: { name: 'one' }, revision: 0 });
		await saveYamlDocument({ file, body: { name: 'two' }, revision: 1 });
		expect(await readBackup(file, '../../hearth-1-r1.yaml')).toBeUndefined();
		expect(await readBackup(file, 'hearth.yaml')).toBeUndefined();
		expect(await readBackup(file, 'other-1-r1.yaml')).toBeUndefined();
	});
});
