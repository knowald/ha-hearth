import { hearthJsonSchema } from '$lib/agent/schema';
import type { RequestHandler } from './$types';

/** The JSON Schema of hearth.yaml, for YAML editors and agents. It holds no data, so it needs no token. */
export const GET: RequestHandler = async () =>
	Response.json(hearthJsonSchema(), { headers: { 'Cache-Control': 'max-age=300' } });
