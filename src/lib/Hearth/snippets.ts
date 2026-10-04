import * as yaml from 'js-yaml';
import * as v from 'valibot';
import { cloneOverviewItem, slugify, uniqueId } from './config';
import { hearthConfigIssues, normalizeHearthConfig } from './normalize';
import { isRecord } from './normalizers';
import { issueLines, ThemeSchema } from './schema';
import type { HearthTheme, OverviewCard, OverviewItem, RailWidget } from './types';

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
	return yaml.dump(tidy(item, withId), { lineWidth: -1 });
}

function load(text: string): SnippetResult<unknown> {
	try {
		return { value: yaml.load(text), issue: null };
	} catch (error) {
		if (error instanceof yaml.YAMLException && error.mark) {
			return fail(`Line ${error.mark.line + 1}: ${error.reason}`); // copy ok: yaml diagnostic
		}
		return fail(error instanceof Error ? error.message.split('\n')[0] : 'Invalid YAML'); // copy ok: yaml diagnostic
	}
}

/**
 * The 1-based line an issue points at: the top-level key it names in a single
 * mapping, or the start of the list entry it names in a list.
 */
function issueLine(text: string, rest: string, index: number, single: boolean): number | null {
	const lines = text.split('\n');
	let found = -1;
	if (single) {
		const key = /^([\w-]+)/.exec(rest)?.[1];
		if (key) found = lines.findIndex((line) => line.startsWith(`${key}:`));
	} else {
		let seen = -1;
		found = lines.findIndex((line) => /^-(\s|$)/.test(line) && ++seen === index);
	}
	return found >= 0 ? found + 1 : null;
}

/** Issue lines from the full-config checker, relative to the snippet instead of the stand-in config. */
function snippetIssue(issues: string[], prefix: string, text: string, single: boolean): string {
	return issues
		.slice(0, MAX_ISSUES)
		.map((issue) => {
			let rest = issue.startsWith(prefix) ? issue.slice(prefix.length) : issue;
			const index = Number(/^\[(\d+)\]/.exec(rest)?.[1] ?? 0);
			if (single) rest = rest.replace(/^\[\d+\]\.?/, '').trim();
			const line = issueLine(text, rest, index, single);
			return line ? `Line ${line}: ${rest}` : rest; // copy ok: yaml diagnostic
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
	const loaded = load(text);
	if (loaded.issue !== null) return loaded;
	const raw = loaded.value;
	if (!isRecord(raw)) return fail(`Expected a YAML mapping for one ${kind}`); // copy ok: yaml diagnostic
	if (kind === 'card' && raw.kind === 'stack') {
		return fail('A stack is edited from its own sheet'); // copy ok: yaml diagnostic
	}
	if (id !== null && raw.id !== undefined && raw.id !== id) {
		const line = issueLine(text, 'id', 0, true);
		return fail(`${line ? `Line ${line}: ` : ''}id must stay ${id}`); // copy ok: yaml diagnostic
	}
	const checked = kind === 'card' ? checkCards([raw], text, true) : checkWidgets([raw], text, true);
	if (checked.issue !== null) return checked;
	const item = checked.value[0] as OverviewCard | RailWidget;
	return { value: id === null ? item : { ...item, id }, issue: null };
}

function snippetList(text: string): SnippetResult<{ items: unknown[]; single: boolean }> {
	if (!text.trim()) return fail('Nothing to paste'); // copy ok: yaml diagnostic
	const loaded = load(text);
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

export function themeDocument(name: string, theme: HearthTheme): string {
	return yaml.dump({ name, theme }, { lineWidth: -1 });
}

export function themeFileName(name: string): string {
	return `hearth-theme-${slugify(name)}.yaml`;
}

/**
 * A theme from a shared file: the `name` and `theme` mapping Export writes, or
 * a bare mapping of tokens as it appears under `theme:` in hearth.yaml.
 */
export function themeFromDocument(text: string): SnippetResult<SharedTheme> {
	const loaded = load(text);
	if (loaded.issue !== null) return loaded;
	const raw = loaded.value;
	if (!isRecord(raw)) return fail('Expected a YAML mapping of theme tokens'); // copy ok: yaml diagnostic
	const wrapped = isRecord(raw.theme);
	const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : undefined;
	const tokens = wrapped ? raw.theme : { ...raw, name: undefined };
	const parsed = v.safeParse(
		ThemeSchema,
		Object.fromEntries(Object.entries(tokens as object).filter(([, value]) => value !== undefined))
	);
	if (!parsed.success) {
		return fail(
			issueLines(parsed.issues, '')
				.slice(0, MAX_ISSUES)
				.map((issue) => {
					const key = /^([\w-]+)/.exec(issue)?.[1];
					const lines = text.split('\n');
					const found = key ? lines.findIndex((line) => line.trim().startsWith(`${key}:`)) : -1;
					return found >= 0 ? `Line ${found + 1}: ${issue}` : issue; // copy ok: yaml diagnostic
				})
				.join('; ')
		);
	}
	if (!Object.keys(parsed.output).length) return fail('The theme has no tokens'); // copy ok: yaml diagnostic
	return { value: { ...(name ? { name } : {}), theme: parsed.output }, issue: null };
}
