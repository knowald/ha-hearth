import { refreshScreens } from '$lib/agent/documents';
import { agentHandler, failure } from '$lib/agent/http';
import type { RequestHandler } from './$types';

/** Reloads every open screen, as the HEARTH refresh event does. */
export const POST: RequestHandler = agentHandler(async ({ token }) => {
	try {
		await refreshScreens(token);
	} catch (error) {
		return failure(502, (error as Error).message);
	}
	return Response.json({ refreshed: true });
});
