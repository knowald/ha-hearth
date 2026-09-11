import { json, error } from '@sveltejs/kit';
import { saveYamlDocument } from '$lib/server/persistence';
import { CONFIG_VERSION, currentHearthConfig } from '$lib/Hearth/format';
import { hearthConfigIssues } from '$lib/Hearth/normalize';
import type { RequestHandler } from './$types';

const CONFIG_PATH = './data/hearth.yaml';

function isMapping(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	if (!isMapping(body)) error(400, 'invalid body');

	const config = body.config;
	if (!isMapping(config)) error(400, 'invalid config');
	try {
		currentHearthConfig(config);
	} catch (err) {
		error(400, err instanceof Error ? err.message : 'unsupported config');
	}
	const issues = hearthConfigIssues(config);
	if (issues.length) error(400, issues.join('; '));
	const revision = body.revision;
	if (!(Number.isInteger(revision) && (revision as number) >= 0)) {
		error(400, 'invalid revision');
	}

	let result;
	try {
		result = await saveYamlDocument({
			file: CONFIG_PATH,
			body: config,
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
