import { readFile, writeFile } from 'fs/promises';
import * as yaml from 'js-yaml';
import * as v from 'valibot';
import { ConfigurationSchema } from '$lib/core/app/configuration';
import { CONFIG_VERSION, currentHearthConfig } from '$lib/Hearth/format';
import { hearthConfigIssues, newThemeIssues, normalizeTheme } from '$lib/Hearth/normalize';
import {
	currentRevision,
	listBackups,
	readBackup,
	readDocument,
	saveYamlDocument,
	type BackupEntry
} from '$lib/server/persistence';

/*
 * The documents an agent can read and change, shared by the agent REST
 * endpoints and the MCP server. Writes go through the same validation and
 * persistence as the editor's saves.
 */

export const DASHBOARD_FILE = './data/hearth.yaml';
export const SETTINGS_FILE = './data/configuration.yaml';
const CSS_FILE = './data/custom_css.css';

function isMapping(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A dashboard given as a parsed mapping or as YAML text. */
export type DashboardInput = { config: unknown } | { yaml: string };

/** The mapping in `input`, or the reason there is none. */
function dashboardOf(
	input: DashboardInput
): { config: Record<string, unknown> } | { issues: string[] } {
	let config: unknown;
	if ('yaml' in input) {
		if (typeof input.yaml !== 'string') return { issues: ['yaml must be text'] };
		try {
			config = yaml.load(input.yaml);
		} catch (error) {
			return { issues: [`YAML does not parse: ${(error as Error).message}`] };
		}
	} else config = input.config;
	if (!isMapping(config)) return { issues: ['Configuration must be a YAML mapping'] };
	return { config: { ...config } };
}

/**
 * Validates a dashboard the way a save does and returns it as it would be
 * stored, or the issues that keep it from being saved.
 */
export function prepareDashboard(
	input: DashboardInput
): { config: Record<string, unknown> } | { issues: string[] } {
	const parsed = dashboardOf(input);
	if ('issues' in parsed) return parsed;
	const { config } = parsed;
	try {
		currentHearthConfig(config);
	} catch (error) {
		return { issues: [error instanceof Error ? error.message : 'unsupported config'] };
	}
	const issues = [...hearthConfigIssues(config), ...newThemeIssues(config)];
	if (issues.length) return { issues };
	// a short #f80 is stored as #ff8800, as loading the file would read it
	for (const slot of ['theme', 'theme_night']) {
		if (isMapping(config[slot])) config[slot] = normalizeTheme(config[slot]);
	}
	for (const entry of Array.isArray(config.theme_schedule) ? config.theme_schedule : []) {
		for (const slot of ['theme', 'night']) {
			if (isMapping(entry) && isMapping(entry[slot])) entry[slot] = normalizeTheme(entry[slot]);
		}
	}
	return { config };
}

export type SaveOutcome =
	| { saved: true; revision: number }
	| { saved: false; conflict: true; revision: number }
	| { saved: false; issues: string[] };

export async function readDashboard(): Promise<{ revision: number; yaml: string }> {
	const text = (await readDocument(DASHBOARD_FILE)) ?? '';
	const parsed = text.trim() ? yaml.load(text) : undefined;
	const revision = isMapping(parsed) && Number.isInteger(parsed.revision) ? parsed.revision : 0;
	return { revision: revision as number, yaml: text };
}

export async function saveDashboard(
	input: DashboardInput,
	revision: number,
	force = false
): Promise<SaveOutcome> {
	const prepared = prepareDashboard(input);
	if ('issues' in prepared) return { saved: false, issues: prepared.issues };
	const result = await saveYamlDocument({
		file: DASHBOARD_FILE,
		body: prepared.config,
		revision,
		force,
		head: { version: CONFIG_VERSION }
	});
	return result.conflict
		? { saved: false, conflict: true, revision: result.revision }
		: { saved: true, revision: result.revision };
}

/** Server settings as stored, with the access token reported but not shown. */
export interface Settings {
	revision: number;
	locale?: string;
	custom_js?: boolean;
	motion?: boolean;
	haptics?: boolean;
	token_set: boolean;
}

async function storedSettings(): Promise<Record<string, unknown>> {
	const text = await readDocument(SETTINGS_FILE);
	const parsed = text?.trim() ? yaml.load(text) : {};
	if (!isMapping(parsed)) throw new Error('configuration.yaml must contain a YAML mapping');
	return parsed;
}

export async function readSettings(): Promise<Settings> {
	const { token, revision, ...rest } = v.parse(ConfigurationSchema, await storedSettings());
	return { revision: revision ?? 0, ...rest, token_set: Boolean(token) };
}

const SETTINGS_FIELDS = ['locale', 'custom_js', 'motion', 'haptics', 'token'] as const;

/** A value in `change` sets the field, null clears it, and a missing key keeps it. */
export async function updateSettings(
	change: Record<string, unknown>,
	revision: number
): Promise<SaveOutcome> {
	const unknown = Object.keys(change).filter(
		(key) => !(SETTINGS_FIELDS as readonly string[]).includes(key)
	);
	if (unknown.length) return { saved: false, issues: [`unknown settings: ${unknown.join(', ')}`] };
	const next: Record<string, unknown> = { ...(await storedSettings()) };
	for (const key of SETTINGS_FIELDS) {
		if (!(key in change)) continue;
		if (change[key] === null) delete next[key];
		else next[key] = change[key];
	}
	delete next.revision;
	const parsed = v.safeParse(ConfigurationSchema, next);
	if (!parsed.success) {
		return {
			saved: false,
			issues: parsed.issues.map((issue) => `${v.getDotPath(issue) ?? 'settings'}: ${issue.message}`)
		};
	}
	const result = await saveYamlDocument({ file: SETTINGS_FILE, body: parsed.output, revision });
	return result.conflict
		? { saved: false, conflict: true, revision: result.revision }
		: { saved: true, revision: result.revision };
}

export async function readCustomCss(): Promise<string> {
	try {
		return await readFile(CSS_FILE, 'utf8');
	} catch (error) {
		if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return '';
		throw error;
	}
}

export async function saveCustomCss(css: string): Promise<void> {
	await writeFile(CSS_FILE, css, 'utf8');
}

export async function listVersions(): Promise<{ revision: number; versions: BackupEntry[] }> {
	// reading the revision first adopts an outside edit, whose backup the
	// listing then includes
	const revision = await currentRevision(DASHBOARD_FILE);
	return { revision, versions: await listBackups(DASHBOARD_FILE) };
}

export function readVersion(name: string): Promise<string | undefined> {
	return readBackup(DASHBOARD_FILE, name);
}

/**
 * Fires the HEARTH refresh event with the caller's token, which reloads every
 * open screen. Home Assistant only lets administrators fire events.
 */
export async function refreshScreens(token: string): Promise<void> {
	const response = await fetch(`${process.env.HASS_URL}/api/events/HEARTH`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({ event: 'refresh' }),
		signal: AbortSignal.timeout(10_000)
	});
	if (!response.ok) {
		throw new Error(
			response.status === 401
				? 'Home Assistant refused the event; firing events needs an administrator token'
				: `Home Assistant answered ${response.status} to the refresh event`
		);
	}
}
