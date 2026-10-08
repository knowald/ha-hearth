import * as yaml from 'js-yaml';
import { readDashboard, saveDashboard } from '$lib/agent/documents';
import { agentHandler, failure, revisionOf, savedResponse } from '$lib/agent/http';
import type { RequestHandler } from './$types';

/** hearth.yaml as JSON, or as the YAML text with ?format=yaml. */
export const GET: RequestHandler = agentHandler(async ({ url }) => {
	const { revision, yaml: text } = await readDashboard();
	if (url.searchParams.get('format') === 'yaml') {
		return new Response(text, {
			headers: {
				'Content-Type': 'application/yaml; charset=utf-8',
				'X-Hearth-Revision': `${revision}`
			}
		});
	}
	return Response.json({ revision, config: text.trim() ? yaml.load(text) : {} });
});

/** Replaces hearth.yaml: { revision, config | yaml, force?, refresh? }. */
export const PUT: RequestHandler = agentHandler(async ({ body, token }) => {
	const revision = revisionOf(body);
	if (revision === undefined) return failure(400, 'revision must be the revision you read');
	const input =
		typeof body.yaml === 'string'
			? { yaml: body.yaml }
			: 'config' in body
				? { config: body.config }
				: null;
	if (!input) return failure(400, 'Send the dashboard as config (an object) or yaml (text)');
	return savedResponse(
		await saveDashboard(input, revision, body.force === true),
		token,
		body.refresh
	);
});
