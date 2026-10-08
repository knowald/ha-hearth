import { handleMcp } from '$lib/agent/mcp';
import type { RequestHandler } from './$types';

// hooks.server.ts runs the transport checks and authorizes the caller
export const POST: RequestHandler = async ({ request, locals }) =>
	locals.token ? handleMcp(request, locals.token) : new Response(null, { status: 401 });

// stateless: there is no stream to open and no session to end
const notAllowed: RequestHandler = () =>
	new Response(null, { status: 405, headers: { Allow: 'POST' } });
export const GET = notAllowed;
export const DELETE = notAllowed;
