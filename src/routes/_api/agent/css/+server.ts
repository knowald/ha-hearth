import { readCustomCss, refreshScreens, saveCustomCss } from '$lib/agent/documents';
import { agentHandler, failure } from '$lib/agent/http';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = agentHandler(async () =>
	Response.json({ css: await readCustomCss() })
);

/** Replaces custom_css.css: { css, refresh? }. */
export const PUT: RequestHandler = agentHandler(async ({ body, token }) => {
	if (typeof body.css !== 'string') return failure(400, 'css must be text');
	await saveCustomCss(body.css);
	if (body.refresh !== true) return Response.json({ saved: true });
	try {
		await refreshScreens(token);
		return Response.json({ saved: true, refreshed: true });
	} catch (error) {
		return Response.json({
			saved: true,
			refreshed: false,
			refresh_error: (error as Error).message
		});
	}
});
