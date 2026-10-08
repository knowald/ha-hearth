import { updateSettings } from '$lib/agent/documents';
import { failure, isMapping, revisionOf } from '$lib/agent/http';
import type { RequestHandler } from './$types';

/**
 * Stores the long-lived token screens connect with: { token, revision }. Any
 * Home Assistant user may, so a wall screen signed in as a regular user can
 * set its own token, but only by signing in with that same token. Every other
 * setting needs an administrator through save_config.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const body = await request.json().catch(() => undefined);
	if (!isMapping(body) || typeof body.token !== 'string' || !body.token) {
		return failure(400, 'token must be text');
	}
	const revision = revisionOf(body);
	if (revision === undefined) return failure(400, 'invalid revision');
	if (!locals.token || body.token !== locals.token) {
		return failure(403, 'The bearer token must be the token being stored');
	}
	const outcome = await updateSettings({ token: body.token }, revision);
	if (!outcome.saved) {
		return 'issues' in outcome
			? failure(400, outcome.issues.join('; '))
			: failure(409, 'conflict', { revision: outcome.revision });
	}
	return Response.json({ action: 'saved', revision: outcome.revision });
};
