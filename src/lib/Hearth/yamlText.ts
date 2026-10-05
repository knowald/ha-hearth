import * as yaml from 'js-yaml';

/*
 * YAML as the editors read and write it. Aliases are refused: a few lines of
 * nested aliases expand into millions of nodes and hang the tab. Merge keys
 * are off in js-yaml's default schema and would load as a literal `<<` key,
 * so they are refused by name rather than saved as one.
 */

export type YamlResult = { value: unknown; issue: null } | { value: null; issue: string };

function lineOf(error: unknown): string {
	return error instanceof yaml.YAMLException && error.mark ? `Line ${error.mark.line + 1}: ` : ''; // copy ok: yaml diagnostic
}

function mergeKeyLine(text: string): number {
	return text.split('\n').findIndex((line) => /^\s*(-\s+)*<<\s*:/.test(line)) + 1;
}

function hasMergeKey(value: unknown): boolean {
	if (Array.isArray(value)) return value.some(hasMergeKey);
	if (!value || typeof value !== 'object') return false;
	return Object.entries(value).some(([key, child]) => key === '<<' || hasMergeKey(child));
}

export function parseYaml(text: string): YamlResult {
	let value: unknown;
	try {
		value = yaml.load(text, { maxAliases: 0 });
	} catch (error) {
		if (!(error instanceof Error)) return { value: null, issue: 'Invalid YAML' }; // copy ok: yaml diagnostic
		const reason = error instanceof yaml.YAMLException ? error.reason : error.message;
		const message = /^aliases exceeded/.test(reason)
			? 'YAML aliases (*name) are not supported, write the value out' // copy ok: yaml diagnostic
			: reason.split('\n')[0];
		return { value: null, issue: `${lineOf(error)}${message}` };
	}
	if (hasMergeKey(value)) {
		const line = mergeKeyLine(text);
		return {
			value: null,
			issue: `${line ? `Line ${line}: ` : ''}YAML merge keys (<<) are not supported, write the keys out` // copy ok: yaml diagnostic
		};
	}
	return { value, issue: null };
}

/** A document without anchors: one object reached twice is written out twice. */
export function dumpYaml(value: unknown): string {
	return yaml.dump(value, { lineWidth: -1, noRefs: true });
}
