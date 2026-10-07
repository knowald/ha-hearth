import { refreshScreens, type SaveOutcome } from './documents';

export function isMapping(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function failure(status: number, message: string, extra: Record<string, unknown> = {}) {
	return Response.json({ error: message, ...extra }, { status });
}

/**
 * Runs `handle` with the request's JSON body for a caller hooks.server.ts
 * authorized, and turns thrown errors into JSON responses.
 */
export function agentHandler(
	handle: (context: {
		request: Request;
		url: URL;
		token: string;
		body: Record<string, unknown>;
	}) => Promise<Response>
) {
	return async ({ request, url, locals }: { request: Request; url: URL; locals: App.Locals }) => {
		// the access policy covers every agent route; refuse rather than run unauthorized
		const token = locals.token;
		if (!token) return failure(401, 'A Home Assistant access token is required');
		let body: Record<string, unknown> = {};
		if (request.method !== 'GET' && request.method !== 'HEAD') {
			const parsed = await request.json().catch(() => undefined);
			if (!isMapping(parsed)) return failure(400, 'The body must be a JSON object');
			body = parsed;
		}
		try {
			return await handle({ request, url, token, body });
		} catch (error) {
			console.error('agent request failed:', error);
			return failure(500, error instanceof Error ? error.message : String(error));
		}
	};
}

export function revisionOf(body: Record<string, unknown>): number | undefined {
	const revision = body.revision;
	return Number.isInteger(revision) && (revision as number) >= 0 ? (revision as number) : undefined;
}

/** The response for a save, refreshing every screen first when the caller asked. */
export async function savedResponse(outcome: SaveOutcome, token: string, refresh: unknown) {
	if (!outcome.saved) {
		return 'issues' in outcome
			? failure(422, 'invalid', { issues: outcome.issues })
			: failure(409, 'conflict', { revision: outcome.revision });
	}
	if (refresh !== true) return Response.json({ revision: outcome.revision });
	try {
		await refreshScreens(token);
		return Response.json({ revision: outcome.revision, refreshed: true });
	} catch (error) {
		return Response.json({
			revision: outcome.revision,
			refreshed: false,
			refresh_error: (error as Error).message
		});
	}
}
