import * as v from 'valibot';
import { THEME_VARS } from '$lib/core/theme';
import { cloneOverviewItem, slugify, uniqueId } from './config';
import { hearthConfigIssues, normalizeHearthConfig } from './normalize';
import { isRecord } from './normalizers';
import { issueLines, ThemeSchema } from './schema';
import type { HearthTheme, OverviewCard, OverviewItem, RailWidget } from './types';
import { dumpYaml, parseYaml } from './yamlText';

/*
 * Single cards, widgets and themes as YAML: the sheets' YAML tab, Copy as
 * YAML, Paste YAML and theme sharing. A snippet goes through the same issue
 * checker and normalizer as a whole hearth.yaml by standing in an otherwise
 * empty config, so it can never hold what a full document could not.
 */

export type SnippetResult<T> = { value: T; issue: null } | { value: null; issue: string };

const MAX_ISSUES = 3;
const CARD_PREFIX = 'rooms[0].cards[0]';
const WIDGET_PREFIX = 'rail';

function fail(issue: string): { value: null; issue: string } {
	return { value: null, issue };
}

/** Without undefined keys, with the id and type first as a person would write them. */
function tidy(item: object, withId: boolean): Record<string, unknown> {
	const { id, kind, type, ...rest } = JSON.parse(JSON.stringify(item));
	return {
		...(withId && id !== undefined ? { id } : {}),
		...(kind !== undefined ? { kind } : {}),
		...(type !== undefined ? { type } : {}),
		...rest
	};
}

/** A card, stack or widget as it is saved. A new item's document leaves the id to Done. */
export function itemDocument(item: OverviewItem | RailWidget, withId = true): string {
	return dumpYaml(tidy(item, withId));
}

interface SourceLine {
	index: number;
	/** Leading spaces before any list dash. */
	lead: number;
	/** Where the content after the dashes starts. */
	indent: number;
	/** Column of the innermost dash, when the line starts a list entry. */
	dash: number | null;
	content: string;
}

function sourceLines(text: string): SourceLine[] {
	return text.split('\n').flatMap((raw, index) => {
		const lead = raw.length - raw.trimStart().length;
		let content = raw.trimStart();
		if (!content || content.startsWith('#')) return [];
		let indent = lead;
		let dash: number | null = null;
		while (/^-(\s|$)/.test(content)) {
			dash = indent;
			const rest = content.slice(1);
			indent += 1 + (rest.length - rest.trimStart().length);
			content = rest.trimStart();
		}
		return [{ index, lead, indent, dash, content }];
	});
}

/** The lines inside an entry that starts at `line`: deeper ones, and a compact list under a key. */
function childLines(lines: SourceLine[], at: number, indent: number, isKey: boolean): SourceLine[] {
	const children: SourceLine[] = [];
	for (const line of lines.slice(at + 1)) {
		if (line.lead > indent || (isKey && line.lead === indent && line.dash === indent)) {
			children.push(line);
		} else break;
	}
	return children;
}

/**
 * The 1-based line of a path like `entities[0].verdict` in a document, or
 * of the deepest part of it that can be found, or null for none.
 */
export function pathLine(text: string, path: (string | number)[]): number | null {
	let block = sourceLines(text);
	let found: number | null = null;
	for (const segment of path) {
		if (!block.length) break;
		if (typeof segment === 'number') {
			const entries = block.filter((line) => line.dash !== null);
			const outer = Math.min(...entries.map((line) => line.dash!));
			const entry = entries.filter((line) => line.dash === outer)[segment];
			if (!entry) break;
			found = entry.index;
			const at = block.indexOf(entry);
			block = [{ ...entry, lead: entry.indent }, ...childLines(block, at, outer, false)];
		} else {
			const outer = Math.min(...block.map((line) => line.indent));
			const at = block.findIndex(
				(line) =>
					line.indent === outer &&
					new RegExp(`^(['"]?)${segment.replace(/[^\w]/g, '\\$&')}\\1\\s*:`).test(line.content)
			);
			if (at < 0) break;
			found = block[at].index;
			block = childLines(block, at, block[at].indent, true);
		}
	}
	return found === null ? null : found + 1;
}

/** `entities[0].verdict must be ...` split into its path and the rest. */
function splitIssue(issue: string): { path: (string | number)[]; message: string } {
	const match = /^((?:\[\d+\]|\.?[\w-]+)(?:\[\d+\]|\.[\w-]+)*)(.*)$/.exec(issue);
	if (!match) return { path: [], message: issue };
	const path = [...match[1].matchAll(/\[(\d+)\]|([\w-]+)/g)].map((part) =>
		part[1] !== undefined ? Number(part[1]) : part[2]
	);
	return { path, message: match[2] };
}

function withLine(text: string, issue: string, base: (string | number)[] = []): string {
	const line = pathLine(text, [...base, ...splitIssue(issue).path]);
	return line ? `Line ${line}: ${issue}` : issue; // copy ok: yaml diagnostic
}

/** Issue lines from the full-config checker, relative to the snippet instead of the stand-in config. */
function snippetIssue(issues: string[], prefix: string, text: string, single: boolean): string {
	return issues
		.slice(0, MAX_ISSUES)
		.map((issue) => {
			let rest = issue.startsWith(prefix) ? issue.slice(prefix.length) : issue;
			if (single) rest = rest.replace(/^\[\d+\]\.?/, '').trim();
			return withLine(text, rest);
		})
		.join('; ');
}

/**
 * Stand-in ids, so a snippet written by hand without any still passes the
 * checker's id rules. Callers set the real ids afterwards.
 */
function withStandInIds(items: unknown[]): unknown[] {
	let next = 0;
	const assign = (item: unknown): unknown => {
		if (!isRecord(item)) return item;
		const copy: Record<string, unknown> = { ...item, id: `snippet-${next++}` };
		if (Array.isArray(item.cards)) copy.cards = item.cards.map(assign);
		return copy;
	};
	return items.map(assign);
}

function checkCards(raw: unknown[], text: string, single: boolean): SnippetResult<OverviewItem[]> {
	const cards = withStandInIds(raw);
	const config = { rail: [], rooms: [{ id: 'snippet', cards: [cards] }] };
	const issues = hearthConfigIssues(config);
	if (issues.length) return fail(snippetIssue(issues, CARD_PREFIX, text, single));
	return { value: normalizeHearthConfig(config).rooms[0].cards![0], issue: null };
}

function checkWidgets(raw: unknown[], text: string, single: boolean): SnippetResult<RailWidget[]> {
	const config = { rail: withStandInIds(raw), rooms: [] };
	const issues = hearthConfigIssues(config);
	if (issues.length) return fail(snippetIssue(issues, WIDGET_PREFIX, text, single));
	return { value: normalizeHearthConfig(config).rail, issue: null };
}

/**
 * One card or widget edited as YAML in its sheet. An existing item keeps its
 * id, which pages, editors and drags address it by; a new one gets its id on
 * Done, so the id the result carries is only a stand-in.
 */
export function itemFromDocument(
	kind: 'card',
	text: string,
	id: string | null
): SnippetResult<OverviewCard>;
export function itemFromDocument(
	kind: 'widget',
	text: string,
	id: string | null
): SnippetResult<RailWidget>;
export function itemFromDocument(
	kind: 'card' | 'widget',
	text: string,
	id: string | null
): SnippetResult<OverviewCard | RailWidget> {
	const loaded = parseYaml(text);
	if (loaded.issue !== null) return loaded;
	const raw = loaded.value;
	if (!isRecord(raw)) return fail(`Expected a YAML mapping for one ${kind}`); // copy ok: yaml diagnostic
	if (kind === 'card' && raw.kind === 'stack') {
		return fail('A stack is edited from its own sheet'); // copy ok: yaml diagnostic
	}
	if (id !== null && raw.id !== undefined && raw.id !== id) {
		return fail(withLine(text, `id must stay ${id}`)); // copy ok: yaml diagnostic
	}
	const checked = kind === 'card' ? checkCards([raw], text, true) : checkWidgets([raw], text, true);
	if (checked.issue !== null) return checked;
	const item = checked.value[0] as OverviewCard | RailWidget;
	return { value: id === null ? item : { ...item, id }, issue: null };
}

function snippetList(text: string): SnippetResult<{ items: unknown[]; single: boolean }> {
	if (!text.trim()) return fail('Nothing to paste'); // copy ok: yaml diagnostic
	const loaded = parseYaml(text);
	if (loaded.issue !== null) return loaded;
	const raw = loaded.value;
	const single = !Array.isArray(raw);
	const items = Array.isArray(raw) ? raw : raw === null || raw === undefined ? [] : [raw];
	if (!items.length) return fail('Nothing to paste'); // copy ok: yaml diagnostic
	return { value: { items, single }, issue: null };
}

/**
 * Cards pasted onto a page: one card or stack, or a list of them, each with
 * an id new across `taken` (which collects them). Inside a stack only cards
 * fit, since stacks do not nest.
 */
export function pastedCards(
	text: string,
	taken: string[],
	inStack = false
): SnippetResult<OverviewItem[]> {
	const list = snippetList(text);
	if (list.issue !== null) return list;
	const { items, single } = list.value;
	if (inStack && items.some((item) => isRecord(item) && item.kind === 'stack')) {
		return fail('A stack cannot go inside a stack'); // copy ok: yaml diagnostic
	}
	const checked = checkCards(items, text, single);
	if (checked.issue !== null) return checked;
	return { value: checked.value.map((item) => cloneOverviewItem(item, taken)), issue: null };
}

/** Widgets pasted into the rail: one or a list, each with an id new across `taken`. */
export function pastedWidgets(text: string, taken: string[]): SnippetResult<RailWidget[]> {
	const list = snippetList(text);
	if (list.issue !== null) return list;
	const checked = checkWidgets(list.value.items, text, list.value.single);
	if (checked.issue !== null) return checked;
	return {
		value: checked.value.map((widget) => {
			const id = uniqueId(slugify(widget.type), taken);
			taken.push(id);
			return { ...widget, id };
		}),
		issue: null
	};
}

/** A shared theme; the same shape as a theme saved on the server. */
export interface SharedTheme {
	name?: string;
	theme: HearthTheme;
}

/** An imported theme, with the keys it carried that are not theme tokens and were left out. */
export interface ImportedTheme extends SharedTheme {
	ignored: string[];
}

export function themeDocument(name: string, theme: HearthTheme): string {
	return dumpYaml({ name, theme });
}

export function themeFileName(name: string): string {
	return `hearth-theme-${slugify(name)}.yaml`;
}

/**
 * A background from someone else's file may only point at this Hearth: a path
 * on this host, an uploaded image, or an image inlined as a data URL. A
 * foreign address would have every dashboard showing it call that host.
 */
function importedBackgroundIssue(value: string): string | null {
	if (value.trim() === 'none') return null;
	const target = /^url\((['"]?)(.*)\1\)$/.exec(value.trim())?.[2] ?? '';
	const local =
		(target.startsWith('/') && !target.startsWith('//')) ||
		target.startsWith('hearth-images/') ||
		target.startsWith('data:image/');
	return local
		? null
		: 'must be none or url() of an uploaded image, a path on this host or a data:image URL'; // copy ok: yaml diagnostic
}

/**
 * A theme from a shared file: the `name` and `theme` mapping Export writes, or
 * a bare mapping of tokens as it appears under `theme:` in hearth.yaml. Keys
 * that are not theme tokens are left out and listed.
 */
export function themeFromDocument(text: string): SnippetResult<ImportedTheme> {
	const loaded = parseYaml(text);
	if (loaded.issue !== null) return loaded;
	const raw = loaded.value;
	if (!isRecord(raw)) return fail('Expected a YAML mapping of theme tokens'); // copy ok: yaml diagnostic
	const wrapped = isRecord(raw.theme);
	const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : undefined;
	const entries = Object.entries(wrapped ? (raw.theme as object) : raw).filter(
		([key]) => wrapped || key !== 'name'
	);
	const tokens = Object.fromEntries(entries.filter(([key]) => key in THEME_VARS));
	const ignored = entries.map(([key]) => key).filter((key) => !(key in THEME_VARS));
	const base = wrapped ? ['theme'] : [];
	const parsed = v.safeParse(ThemeSchema, tokens);
	const issues = parsed.success ? [] : issueLines(parsed.issues, '');
	if (typeof tokens.background_image === 'string') {
		const issue = importedBackgroundIssue(tokens.background_image);
		if (issue) issues.push(`background_image ${issue}`);
	}
	if (issues.length) {
		return fail(
			issues
				.slice(0, MAX_ISSUES)
				.map((issue) => withLine(text, issue, base))
				.join('; ')
		);
	}
	if (!Object.keys(tokens).length) return fail('The theme has no tokens'); // copy ok: yaml diagnostic
	return {
		value: { ...(name ? { name } : {}), theme: tokens as HearthTheme, ignored },
		issue: null
	};
}
