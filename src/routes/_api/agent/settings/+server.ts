import { readSettings, updateSettings } from '$lib/agent/documents';
import { agentHandler, failure, revisionOf, savedResponse } from '$lib/agent/http';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = agentHandler(async () => Response.json(await readSettings()));

/** Changes configuration.yaml: { revision, locale?, custom_js?, motion?, haptics?, token? }. */
export const PATCH: RequestHandler = agentHandler(async ({ body, token }) => {
	const revision = revisionOf(body);
	if (revision === undefined) return failure(400, 'revision must be the revision you read');
	const change = { ...body };
	delete change.revision;
	delete change.refresh;
	return savedResponse(await updateSettings(change, revision), token, body.refresh);
});
