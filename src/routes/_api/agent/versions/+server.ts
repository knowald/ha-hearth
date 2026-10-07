import { listVersions, readVersion } from '$lib/agent/documents';
import { agentHandler, failure } from '$lib/agent/http';
import type { RequestHandler } from './$types';

/** The backups of hearth.yaml, or one backup's YAML text with ?name=. */
export const GET: RequestHandler = agentHandler(async ({ url }) => {
	const name = url.searchParams.get('name');
	if (name === null) return Response.json(await listVersions());
	const content = await readVersion(name);
	if (content === undefined) return failure(404, 'no such version');
	return Response.json({ name, content });
});
