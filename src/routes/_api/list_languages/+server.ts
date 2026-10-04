import { json, error } from '@sveltejs/kit';
import { listLocales } from '$lib/server/translations';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ setHeaders }) => {
	try {
		const languages = await listLocales();

		setHeaders({ 'Cache-Control': 'max-age=0' });

		return json(languages);
	} catch (err: any) {
		error(500, err.message);
	}
};
