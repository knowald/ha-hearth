import type { Access } from './auth';

/*
 * Which /_api requests need a token, by SvelteKit route id. Every write needs
 * one unless it is listed as open here, so a new endpoint is protected by
 * default. Reads stay open: screens without a Home Assistant session load the
 * dashboard, and the page itself hands out the stored token anyway.
 */

const ADMIN: Record<string, string[]> = {
	'/_api/save_config': ['POST'],
	'/_api/custom_css': ['POST'],
	'/_api/agent/css': ['PUT'],
	'/_api/agent/settings': ['PATCH']
};

// requests that use POST to read
const OPEN: Record<string, string[]> = {
	'/_api/get_translation': ['POST']
};

const READS = ['GET', 'HEAD', 'OPTIONS'];

/** The access a request needs, or undefined when it needs no token. */
export function requiredAccess(route: string | null, method: string): Access | undefined {
	if (!route?.startsWith('/_api/')) return undefined;
	if (ADMIN[route]?.includes(method)) return 'admin';
	// agents read through the same token as they write
	if (route.startsWith('/_api/agent/')) return 'user';
	if (READS.includes(method) || OPEN[route]?.includes(method)) return undefined;
	return 'user';
}
