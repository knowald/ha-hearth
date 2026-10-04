import { json, error } from '@sveltejs/kit';
import { loadTranslations } from '$lib/server/translations';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, setHeaders }) => {
	try {
		const body = await request.json();

		if (!body.locale || typeof body.locale !== 'string') {
			throw new Error('Invalid locale');
		}

		const translations = await loadTranslations(body.locale);

		setHeaders({ 'Cache-Control': 'max-age=0' });

		return json(translations);
	} catch (err: any) {
		error(500, err.message);
	}
};
