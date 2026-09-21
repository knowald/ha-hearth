import { readFile } from 'fs/promises';
import { dev } from '$app/environment';
import * as yaml from 'js-yaml';
import { ConfigurationSchema, type Configuration } from '$lib/core/app/configuration';
import * as v from 'valibot';
import type { Translations } from '$lib/core/i18n';
import { CONFIG_VERSION, configVersion } from '$lib/Hearth/format';
import { hearthConfigIssues } from '$lib/Hearth/normalize';
import dotenv from 'dotenv';
import type { PageServerLoad } from './$types';

dotenv.config({ quiet: true });

async function loadYaml(file: string) {
	try {
		const data = await readFile(file, 'utf8');
		return data.trim() ? yaml.load(data) : undefined;
	} catch (error) {
		if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return undefined;
		throw error;
	}
}

async function loadJson(file: string) {
	try {
		return JSON.parse(await readFile(file, 'utf8'));
	} catch {
		return {};
	}
}

export const load = (async ({
	request
}): Promise<{
	configuration: Configuration;
	hearth: unknown;
	hearthError: string | null;
	hearthNeedsSetup: boolean;
	hearthRevision: number;
	translations: Translations;
}> => {
	let configuration: Configuration = { revision: 0 };
	try {
		const loaded = await loadYaml('./data/configuration.yaml');
		if (loaded !== undefined && (!loaded || typeof loaded !== 'object' || Array.isArray(loaded))) {
			throw new Error('configuration.yaml must contain a YAML mapping');
		}
		configuration = v.parse(ConfigurationSchema, loaded ?? {});
		configuration.revision ??= 0;
	} catch (error) {
		console.error('configuration.yaml could not be read, using defaults:', error);
	}
	let hearth: unknown;
	let hearthError: string | null = null;
	try {
		hearth = await loadYaml('./data/hearth.yaml');
		if (hearth !== undefined && (!hearth || typeof hearth !== 'object' || Array.isArray(hearth))) {
			hearthError = 'Hearth configuration must contain a YAML mapping';
		} else if (
			hearth !== undefined &&
			Object.keys(hearth as object).length > 0 &&
			configVersion(hearth) !== CONFIG_VERSION
		) {
			hearthError = `Hearth configuration version ${configVersion(hearth)} is unsupported; expected ${CONFIG_VERSION}`;
		}
	} catch (error) {
		hearthError =
			error instanceof Error
				? `Hearth configuration could not be loaded: ${error.message}`
				: 'Hearth configuration could not be loaded';
	}
	if (!hearthError && hearth && Object.keys(hearth as object).length > 0) {
		const issues = hearthConfigIssues(hearth);
		if (issues.length) hearthError = issues.join('; ');
	}

	// the client normalizes whatever it gets; a file that failed above would
	// throw there instead of showing the load error
	if (hearthError) hearth = undefined;
	const rawRevision = (hearth as Record<string, unknown> | undefined)?.revision;
	const hearthRevision = typeof rawRevision === 'number' ? rawRevision : 0;
	const hearthKeys = hearthError
		? []
		: Object.keys((hearth as Record<string, unknown> | undefined) ?? {}).filter(
				(key) => key !== 'revision' && key !== 'version'
			);
	const hearthNeedsSetup = !hearthError && (hearth === undefined || hearthKeys.length === 0);

	// Ingress: Supervisor forwards the browser's HA origin. Fusion used this
	// as hassUrl so OAuth authorizes against the HTTPS Nabu Casa (or local)
	// host the browser is already on.
	const source = request.headers.get('x-hass-source');
	const forwardedProto = request.headers.get('x-forwarded-proto');
	const forwardedHost = request.headers.get('x-forwarded-host');
	configuration.hassUrl =
		(source && forwardedProto && forwardedHost
			? `${forwardedProto}://${forwardedHost}`
			: process.env.HASS_PUBLIC_URL || process.env.HASS_URL) || undefined;

	// Load the selected language with English fallback.
	const dir = dev ? './static' : './build/client';
	const [en, locale] = await Promise.all([
		loadJson(`${dir}/translations/en.json`),
		configuration?.locale && configuration.locale !== 'en'
			? loadJson(`${dir}/translations/${configuration.locale}.json`)
			: undefined
	]);

	return {
		configuration,
		hearth,
		hearthError,
		hearthNeedsSetup,
		hearthRevision,
		translations: locale ? { ...locale, _default: en } : en
	};
}) satisfies PageServerLoad;
