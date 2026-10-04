import { readdir, readFile } from 'fs/promises';
import { dev } from '$app/environment';
import { mergeTranslations, type Translations } from '$lib/core/i18n';

/*
 * static/translations/<locale>.json holds the Home Assistant strings that
 * scripts/translations/generate.sh rewrites; static/translations/hearth/
 * holds Hearth's own copy for the same locales and is never generated.
 */

export function translationsDir() {
	return dev ? './static/translations' : './build/client/translations';
}

/** The locales Home Assistant ships, one file each. */
export async function listLocales(dir = translationsDir()): Promise<string[]> {
	const files = await readdir(dir, { withFileTypes: true });
	return files
		.filter((file) => file.isFile() && file.name.endsWith('.json'))
		.map((file) => file.name.slice(0, -'.json'.length))
		.sort();
}

export class UnknownLocaleError extends Error {
	constructor(locale: string) {
		super(`Unknown locale ${locale}`);
	}
}

async function readJson(file: string): Promise<Translations> {
	try {
		return JSON.parse(await readFile(file, 'utf8'));
	} catch {
		return {};
	}
}

/**
 * English, or a locale laid over English key by key. A locale outside the
 * list is refused rather than read, since it ends up in a file path.
 */
export async function loadTranslations(
	locale: string | undefined,
	dir = translationsDir()
): Promise<Translations> {
	const english = Promise.all([readJson(`${dir}/en.json`), readJson(`${dir}/hearth/en.json`)]);
	if (!locale || locale === 'en') return mergeTranslations(await english);
	if (!(await listLocales(dir)).includes(locale)) throw new UnknownLocaleError(locale);
	const local = Promise.all([
		readJson(`${dir}/${locale}.json`),
		readJson(`${dir}/hearth/${locale}.json`)
	]);
	return mergeTranslations(await english, await local);
}
