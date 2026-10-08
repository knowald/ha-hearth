import { json, error } from '@sveltejs/kit';
import { currentRevision, listBackups, readBackup, readDocument } from '$lib/server/persistence';
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
			// reading the revision first adopts an outside edit, whose backup the
			// listing then includes
			const revision = await currentRevision(CONFIG_PATH);
			return json({ revision, versions: await listBackups(CONFIG_PATH) });
		}
		const content =
			name === CURRENT
				? ((await readDocument(CONFIG_PATH)) ?? '')
				: await readBackup(CONFIG_PATH, name);
		if (content === undefined) error(404, 'no such version');
		return json({ name, content });
	} catch (failure: any) {
		if (failure?.status) throw failure;
		error(500, `Cannot read Hearth versions: ${failure?.message ?? 'unknown error'}`);
	}
};
