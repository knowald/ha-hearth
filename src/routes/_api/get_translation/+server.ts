import { json, error } from '@sveltejs/kit';
import { loadTranslations, UnknownLocaleError } from '$lib/server/translations';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, setHeaders }) => {
	const body = await request.json().catch(() => undefined);
	if (!body?.locale || typeof body.locale !== 'string') error(400, 'Invalid locale');

	try {
		const translations = await loadTranslations(body.locale);

		setHeaders({ 'Cache-Control': 'max-age=0' });

		return json(translations);
	} catch (err: any) {
		if (err instanceof UnknownLocaleError) error(400, err.message);
		error(500, err.message);
	}
};
