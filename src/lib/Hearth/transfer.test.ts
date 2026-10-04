import { describe, expect, it } from 'vitest';
import * as yaml from 'js-yaml';
import { CONFIG_VERSION } from './format';
import {
	configDocument,
	documentIssue,
	parseDocument,
	transferFileName,
	withoutRevision
} from './transfer';
import type { HearthConfig } from './types';

const config = {
	rail: [],
	rooms: [{ id: 'home', name: 'Home', cards: [[]] }],
	revision: 7
} as unknown as HearthConfig;

describe('configDocument', () => {
	it('declares the format version and drops the save counter', () => {
		const document = yaml.load(configDocument(config)) as Record<string, unknown>;
		expect(document.version).toBe(CONFIG_VERSION);
		expect(document.revision).toBeUndefined();
		expect(document.rooms).toHaveLength(1);
	});

	it('round trips through an import', () => {
		const restored = parseDocument(configDocument(config));
		expect(restored?.rooms[0].name).toBe('Home');
	});
});

describe('transferFileName', () => {
	it('names the file after the date and time it covers', () => {
		expect(transferFileName(new Date(2026, 8, 21, 9, 5))).toBe('hearth-2026-09-21-0905.yaml');
	});
});

describe('documentIssue', () => {
	it('passes a document the dashboard can load', () => {
		expect(documentIssue(configDocument(config))).toBeNull();
	});

	it('reports YAML that does not parse', () => {
		expect(documentIssue('rooms: [\n')).toMatch(/./);
	});

	it('rejects a sequence, which would normalize to an empty dashboard', () => {
		expect(documentIssue('- one\n- two')).toBe('Configuration must be a YAML mapping');
	});

	it('rejects a document written by an unsupported format version', () => {
		expect(documentIssue(`version: ${CONFIG_VERSION + 1}\nrooms: []\n`)).toContain('version');
	});

	it('reports a page whose fields are wrong rather than dropping it', () => {
		expect(documentIssue('rooms:\n  - id: 4\n')).toBeTruthy();
	});
});

describe('parseDocument', () => {
	it('returns nothing for a document with an issue', () => {
		expect(parseDocument('- one')).toBeNull();
	});
});

describe('withoutRevision', () => {
	it('drops the counter a save writes at the head of the file', () => {
		expect(withoutRevision('revision: 7\nversion: 5\nrooms: []\n')).toBe('version: 5\nrooms: []\n');
	});

	it('leaves a document that does not open with one alone', () => {
		expect(withoutRevision('version: 5\nrevision: 7\n')).toBe('version: 5\nrevision: 7\n');
	});
});

describe('theme values in hearth.yaml', () => {
	const document = (theme: string) =>
		`version: ${CONFIG_VERSION}\nrail: []\nrooms:\n  - id: home\n    cards: [[]]\ntheme:\n${theme}`;

	it.each([
		['  accent: "red; display: none"\n', 'theme.accent must be a hex colour like #f0b860'],
		[
			'  text_1: "#fff /*"\n',
			'theme.text_1 must not contain comments, backslashes, braces or angle brackets'
		]
	])('reports %s instead of applying it', (theme, issue) => {
		expect(documentIssue(document(theme))).toBe(issue);
	});

	it('keeps a data URL background', () => {
		expect(
			documentIssue(document('  background_image: url(data:image/png;base64,iVBORw0KGgo=)\n'))
		).toBeNull();
	});
});

describe('aliases', () => {
	it('refuses them in a whole document', () => {
		expect(documentIssue('a: &a [x, x]\nb: [*a, *a]\n')).toMatch(
			/^Line 2: YAML aliases \(\*name\) are not supported/
		);
	});

	it('writes no anchors for an object reached twice', () => {
		const shared = { entity: 'light.a' };
		const text = configDocument({
			...config,
			rooms: [
				{
					id: 'home',
					name: 'Home',
					cards: [[{ id: 'a', type: 'entities', entities: [shared, shared] }]]
				}
			]
		} as unknown as HearthConfig);
		expect(text).not.toContain('&');
		expect(documentIssue(text)).toBeNull();
	});
});
