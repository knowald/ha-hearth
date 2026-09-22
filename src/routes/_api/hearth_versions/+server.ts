import { readFile } from 'fs/promises';
import { json, error } from '@sveltejs/kit';
import { currentRevision, listBackups, readBackup } from '$lib/server/persistence';
import type { RequestHandler } from './$types';

const CONFIG_PATH = './data/hearth.yaml';

/** The name that asks for the live document rather than one of its backups. */
const CURRENT = 'current';

/**
 * The snapshots `saveYamlDocument` leaves behind, and their contents. Restoring
 * one is a normal edit the client applies and saves, so there is no write here.
 */
export const GET: RequestHandler = async ({ url, setHeaders }) => {
	setHeaders({ 'Cache-Control': 'no-store' });
	const name = url.searchParams.get('name');
	try {
		if (name === null) {
			const [revision, versions] = await Promise.all([
				currentRevision(CONFIG_PATH),
				listBackups(CONFIG_PATH)
			]);
			return json({ revision, versions });
		}
		const content =
			name === CURRENT
				? await readFile(CONFIG_PATH, 'utf8').catch((failure) => {
						if ((failure as NodeJS.ErrnoException)?.code === 'ENOENT') return '';
						throw failure;
					})
				: await readBackup(CONFIG_PATH, name);
		if (content === undefined) error(404, 'no such version');
		return json({ name, content });
	} catch (failure: any) {
		if (failure?.status) throw failure;
		error(500, `Cannot read Hearth versions: ${failure?.message ?? 'unknown error'}`);
	}
};
