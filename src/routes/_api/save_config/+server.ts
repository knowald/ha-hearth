import { json } from '@sveltejs/kit';
import { saveYamlDocument } from '$lib/server/persistence';
import { ConfigurationSchema } from '$lib/core/app/configuration';
import * as v from 'valibot';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return new Response(JSON.stringify({ error: 'Configuration must be a mapping' }), {
			status: 400
		});
	}

	const revision = body.revision;
	if (!Number.isInteger(revision) || revision < 0)
		return json({ error: 'invalid revision' }, { status: 400 });
	const parsed = v.safeParse(ConfigurationSchema, body);
	if (!parsed.success) return json({ error: 'invalid application settings' }, { status: 400 });
	const document: Record<string, unknown> = { ...parsed.output };
	delete document.revision;
	try {
		const result = await saveYamlDocument({
			file: 'data/configuration.yaml',
			body: document,
			revision
		});
		if (result.conflict) {
			return new Response(JSON.stringify({ error: 'conflict', revision: result.revision }), {
				status: 409
			});
		}
		return json({ action: 'saved', revision: result.revision });
	} catch (err: any) {
		return new Response(JSON.stringify({ error: err?.message ?? 'save failed' }), {
			status: 500
		});
	}
};
