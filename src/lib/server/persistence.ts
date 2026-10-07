import { randomUUID } from 'crypto';
import { basename, dirname, join, resolve } from 'path';
import { mkdir, open, readdir, readFile, rename, stat, unlink } from 'fs/promises';
import * as yaml from 'js-yaml';

/*
 * The one way a YAML document under data/ is written. Every save goes through
 * a per-file critical section, an atomic replace, a timestamped backup and a
 * server-managed `revision` counter that clients echo back so two tabs cannot
 * silently overwrite each other.
 *
 * Adapter-node serves concurrent requests in one process, which the lock
 * covers. Deployments with several server processes need a cross-process lock
 * in front of these endpoints.
 *
 * Files may also change outside Hearth, over SSH, Samba or an agent editing
 * them in place. Hearth keeps a copy of what it last wrote next to the
 * backups; a document that no longer matches it is adopted as a new revision
 * before anything reads or replaces it. See adoptOutsideEdit.
 */

const BACKUP_KEEP = 10;

function backupDirectory(file: string) {
	// one directory per document: hearth.yaml and hearth.yml never share retention
	return join(dirname(file), 'backups', basename(file));
}

function backupStem(file: string) {
	return basename(file).replace(/\.ya?ml$/, '');
}

const locks = new Map<string, Promise<void>>();

async function withFileLock<T>(file: string, operation: () => Promise<T>): Promise<T> {
	// callers spell the same file differently (./data/x.yaml, data/x.yaml)
	const key = resolve(file);
	const previous = locks.get(key) ?? Promise.resolve();
	let release!: () => void;
	const current = new Promise<void>((done) => (release = done));
	locks.set(key, current);
	await previous;
	try {
		return await operation();
	} finally {
		release();
		if (locks.get(key) === current) locks.delete(key);
	}
}

async function readText(file: string): Promise<string | undefined> {
	try {
		return await readFile(file, 'utf8');
	} catch (error) {
		if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return undefined;
		throw error;
	}
}

function revisionOf(parsed: unknown): number {
	const revision = (parsed as Record<string, unknown> | undefined)?.revision;
	return typeof revision === 'number' && Number.isInteger(revision) ? revision : 0;
}

/** The revision a document's text holds, 0 for none. Malformed YAML throws. */
function textRevision(text: string | undefined): number {
	return text?.trim() ? revisionOf(yaml.load(text)) : 0;
}

/** The document's revision, 0 for a missing file. Malformed YAML and I/O failures throw. */
export async function currentRevision(file: string): Promise<number> {
	return withFileLock(file, async () => {
		await adoptOutsideEdit(file);
		return textRevision(await readText(file));
	});
}

/**
 * The document's text after adopting any outside edit, or undefined for a
 * missing file. Readers that show the document use this, so the revision they
 * hand out already counts the outside edit.
 */
export async function readDocument(file: string): Promise<string | undefined> {
	return withFileLock(file, async () => {
		await adoptOutsideEdit(file);
		return readText(file);
	});
}

/** Where Hearth keeps a copy of what it last wrote to `file`. */
function writtenCopy(file: string) {
	return join(dirname(file), 'backups', `.${basename(file)}.written`);
}

/**
 * Best-effort: without the copy, the next read takes the file as it is
 * instead of adopting it as an outside edit.
 */
async function recordWritten(file: string, text: string) {
	try {
		await mkdir(dirname(writtenCopy(file)), { recursive: true });
		await atomicWriteFile(writtenCopy(file), text);
	} catch (error) {
		console.warn(`Could not record the written copy of ${file}:`, error);
	}
}

/** `text` with its top-level revision set, keeping the rest of the file as it was written. */
function withRevision(text: string, revision: number): string {
	const line = `revision: ${revision}`;
	const pattern = /^revision:.*$/m;
	const edited = pattern.test(text) ? text.replace(pattern, line) : `${line}\n${text}`;
	// a document marker, directive or flow mapping at the top defeats the line
	// edit; a plain dump of the parsed document is correct, if less faithful
	try {
		if (revisionOf(yaml.load(edited)) === revision) return edited;
	} catch {
		// fall through
	}
	const rest = yaml.load(text) as Record<string, unknown>;
	delete rest.revision;
	return yaml.dump({ revision, ...rest });
}

/**
 * A document that differs from the copy Hearth last wrote was changed outside
 * Hearth. That copy goes to the backups, so the outside edit can be undone,
 * and the file gets the next revision in place, so a browser that loaded the
 * earlier one conflicts on save instead of replacing the outside edit. A file
 * Hearth has never written is taken as it is. One that does not parse to a
 * mapping is left for the load error to report and adopted once it is fixed.
 */
async function adoptOutsideEdit(file: string) {
	const text = await readText(file);
	if (text === undefined) return;
	const written = await readText(writtenCopy(file)).catch(() => null);
	// an unreadable copy cannot tell an outside edit apart
	if (written === text || written === null) return;
	let parsed: unknown;
	try {
		parsed = yaml.load(text);
	} catch {
		return;
	}
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
	if (written === undefined) {
		await recordWritten(file, text);
		return;
	}
	let writtenRevision = 0;
	try {
		writtenRevision = textRevision(written);
	} catch {
		// the copy only ever holds what Hearth wrote; a damaged one still gets backed up
	}
	const next = withRevision(text, Math.max(revisionOf(parsed), writtenRevision) + 1);
	await backupText(file, written, writtenRevision);
	await atomicWriteFile(file, next);
	await recordWritten(file, next);
	await pruneBackups(file);
}

/**
 * Keeps `text`, the revision `revision` of `file`, among its backups. The name
 * carries the revision, which is unique per document, so two saves in the
 * same millisecond cannot share a backup. A failure aborts the save, since a
 * save that cannot be undone is worse than one that has to be retried.
 */
async function backupText(file: string, text: string, revision: number) {
	const directory = backupDirectory(file);
	try {
		await mkdir(directory, { recursive: true });
		await atomicWriteFile(
			join(directory, `${backupStem(file)}-${Date.now()}-r${revision}.yaml`),
			text
		);
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		throw new Error(`Could not back up ${file} before saving: ${detail}`, { cause: error });
	}
}

const BACKUP_NAME = /^(.+)-(\d+)(?:-r\d+)?\.yaml$/;

async function pruneBackups(file: string) {
	const directory = backupDirectory(file);
	const stem = backupStem(file);
	try {
		const backups = (await readdir(directory))
			.map((name) => ({ name, match: BACKUP_NAME.exec(name) }))
			.filter(({ match }) => match?.[1] === stem)
			.map(({ name, match }) => ({ name, at: Number(match![2]) }))
			.sort((a, b) => b.at - a.at || b.name.localeCompare(a.name));
		await Promise.all(backups.slice(BACKUP_KEEP).map(({ name }) => unlink(join(directory, name))));
	} catch {
		// pruning is best-effort
	}
}

async function atomicWriteFile(file: string, data: string) {
	const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
	const handle = await open(temporary, 'wx');
	let openHandle = true;
	try {
		await handle.writeFile(data, 'utf8');
		await handle.sync();
		await handle.close();
		openHandle = false;
		await rename(temporary, file);

		// Persist the directory entry as well as the file contents. Some platforms
		// cannot open directories; the atomic rename has still completed there.
		try {
			const directory = await open(dirname(file), 'r');
			try {
				await directory.sync();
			} finally {
				await directory.close();
			}
		} catch {
			// best-effort durability after the atomic replacement
		}
	} catch (error) {
		if (openHandle) await handle.close().catch(() => {});
		await unlink(temporary).catch(() => {});
		throw error;
	}
}

export interface SaveRequest {
	file: string;
	/** The document body; keys it shares with `head` or `revision` never win. */
	body: Record<string, unknown>;
	/** The revision the client loaded. Every write participates in conflict detection. */
	revision: number;
	force?: boolean;
	/** Extra server-managed keys written before the body, e.g. a schema version. */
	head?: Record<string, unknown>;
}

export type SaveResult =
	{ conflict: true; revision: number } | { conflict: false; revision: number };

/**
 * Replaces `file` with `body` unless the client's revision is stale. The next
 * revision number is written into the document and returned.
 */
export async function saveYamlDocument(request: SaveRequest): Promise<SaveResult> {
	return withFileLock(request.file, async () => {
		await adoptOutsideEdit(request.file);
		const current = await readText(request.file);
		const revision = textRevision(current);
		if (request.force !== true && request.revision !== revision) {
			return { conflict: true as const, revision };
		}
		const head: Record<string, unknown> = { revision: revision + 1, ...(request.head ?? {}) };
		head.revision = revision + 1;
		const body = { ...request.body };
		for (const key of Object.keys(head)) delete body[key];
		const data = yaml.dump({ ...head, ...body });
		if (current !== undefined) await backupText(request.file, current, revision);
		await atomicWriteFile(request.file, data);
		await recordWritten(request.file, data);
		await pruneBackups(request.file);
		return { conflict: false as const, revision: revision + 1 };
	});
}

export interface BackupEntry {
	name: string;
	/** Milliseconds since the epoch, from the backup's own name. */
	at: number;
	/** The revision the backup holds, absent in files written before revisions were named. */
	revision?: number;
	size: number;
}

const BACKUP_REVISION = /-r(\d+)\.yaml$/;

/** The document's saved backups, newest first. A document with none lists empty. */
export async function listBackups(file: string): Promise<BackupEntry[]> {
	const directory = backupDirectory(file);
	const stem = backupStem(file);
	let names: string[];
	try {
		names = await readdir(directory);
	} catch (error) {
		if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return [];
		throw error;
	}
	const entries = await Promise.all(
		names.map(async (name): Promise<BackupEntry | undefined> => {
			const match = BACKUP_NAME.exec(name);
			if (match?.[1] !== stem) return undefined;
			const size = await stat(join(directory, name))
				.then((info) => info.size)
				.catch(() => 0);
			const revision = BACKUP_REVISION.exec(name)?.[1];
			return {
				name,
				at: Number(match[2]),
				...(revision === undefined ? {} : { revision: Number(revision) }),
				size
			};
		})
	);
	return entries
		.filter((entry) => entry !== undefined)
		.sort((a, b) => b.at - a.at || b.name.localeCompare(a.name));
}

/**
 * One backup's YAML text. The name is resolved against the listing rather
 * than joined onto the directory, so no request can read outside it.
 */
export async function readBackup(file: string, name: string): Promise<string | undefined> {
	const found = (await listBackups(file)).some((entry) => entry.name === name);
	if (!found) return undefined;
	return readFile(join(backupDirectory(file), name), 'utf8');
}
