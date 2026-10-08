import { json, error } from '@sveltejs/kit';
import { prepareDashboard } from '$lib/agent/documents';
import { saveYamlDocument } from '$lib/server/persistence';
import { CONFIG_VERSION } from '$lib/Hearth/format';
import type { RequestHandler } from './$types';

const CONFIG_PATH = './data/hearth.yaml';

function isMapping(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	if (!isMapping(body)) error(400, 'invalid body');

	if (!isMapping(body.config)) error(400, 'invalid config');
	const prepared = prepareDashboard({ config: body.config });
	if ('issues' in prepared) error(400, prepared.issues.join('; '));
	const revision = body.revision;
	if (!(Number.isInteger(revision) && (revision as number) >= 0)) {
		error(400, 'invalid revision');
	}

	let result;
	try {
		result = await saveYamlDocument({
			file: CONFIG_PATH,
			body: prepared.config,
			revision: revision as number,
			force: body.force === true,
			head: { version: CONFIG_VERSION }
		});
	} catch (err: any) {
		// Malformed YAML and I/O failures must abort the save rather than let a
		// fallback revision overwrite the file.
		error(500, `Cannot save Hearth configuration: ${err?.message ?? 'unknown error'}`);
	}

	if (result.conflict) return json({ revision: result.revision }, { status: 409 });
	return json({ revision: result.revision });
};
