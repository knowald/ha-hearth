import { prepareDashboard } from '$lib/agent/documents';
import { agentHandler, failure } from '$lib/agent/http';
import type { RequestHandler } from './$types';

/** Checks a dashboard without saving it: { config | yaml } -> { valid, issues }. */
export const POST: RequestHandler = agentHandler(async ({ body }) => {
	const input =
		typeof body.yaml === 'string'
			? { yaml: body.yaml }
			: 'config' in body
				? { config: body.config }
				: null;
	if (!input) return failure(400, 'Send the dashboard as config (an object) or yaml (text)');
	const prepared = prepareDashboard(input);
	const issues = 'issues' in prepared ? prepared.issues : [];
	return Response.json({ valid: issues.length === 0, issues });
});
