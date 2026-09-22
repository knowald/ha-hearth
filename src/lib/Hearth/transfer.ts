import * as yaml from 'js-yaml';
import { CONFIG_VERSION, currentHearthConfig } from './format';
import { hearthConfigIssues, normalizeHearthConfig } from './normalize';
import type { HearthConfig } from './types';

/*
 * Moving a dashboard in and out of the app as a file: the YAML editor's
 * Import and Export, and the saved versions the same checks are applied to
 * before one can be restored.
 */

/** The document an export writes: the config with the format version, without the save counter. */
export function configDocument(config: HearthConfig): string {
	const body: Record<string, unknown> = { ...config };
	delete body.revision;
	return yaml.dump({ version: CONFIG_VERSION, ...body });
}

/**
 * A saved document without the server's save counter. Every file carries a
 * `revision` the editor's own document never has, so comparing the two without
 * dropping it would report a change on the first line every time.
 */
export function withoutRevision(text: string): string {
	return text.replace(/^revision:[^\n]*\n/, '');
}

function pad(value: number) {
	return String(value).padStart(2, '0');
}

/** A file name that sorts by date and never collides across a minute. */
export function transferFileName(date: Date, stem = 'hearth'): string {
	const parts = [date.getFullYear(), date.getMonth() + 1, date.getDate()].map(pad).join('-');
	return `${stem}-${parts}-${pad(date.getHours())}${pad(date.getMinutes())}.yaml`;
}

/**
 * Why `text` could not be applied as a dashboard, or null when it can be.
 * Scalars and sequences parse fine but would normalize to the default config,
 * silently wiping the layout, so only a mapping is acceptable.
 */
export function documentIssue(text: string): string | null {
	let parsed: unknown;
	try {
		parsed = yaml.load(text);
	} catch (error) {
		return error instanceof Error ? error.message.split('\n')[0] : 'Invalid YAML'; // copy ok: yaml diagnostic
	}
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		return 'Configuration must be a YAML mapping'; // copy ok: yaml diagnostic
	}
	try {
		const issues = hearthConfigIssues(currentHearthConfig(parsed));
		return issues.length ? issues.slice(0, 5).join('; ') : null;
	} catch (error) {
		return error instanceof Error ? error.message.split('\n')[0] : 'Invalid configuration'; // copy ok: yaml diagnostic
	}
}

/** The config `text` describes, or null when `documentIssue` would report on it. */
export function parseDocument(text: string): HearthConfig | null {
	if (documentIssue(text)) return null;
	return normalizeHearthConfig(yaml.load(text));
}
