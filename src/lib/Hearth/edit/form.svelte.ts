import { fromStore } from 'svelte/store';
import { lang } from '$lib/core/i18n';
import { integerFromInput, numberFromInput } from './numbers';
import { requireFields, type Validity } from './validation';

/** What a control holds while it is edited: a switch's state, otherwise its text. */
export type RawValue = string | boolean;
export type FormValues = Record<string, RawValue>;

/**
 * One option of a card or widget, described as data for FormRenderer. Copy
 * (label, hint, example, reason, invalid, option labels) is given as
 * translation keys.
 */
export interface EditorField<T> {
	key: Extract<keyof T, string>;
	/**
	 * The control, which also decides how the text is stored: text-like kinds
	 * trimmed or absent, number parsed, list split on commas, code verbatim.
	 */
	kind: 'text' | 'number' | 'list' | 'select' | 'check' | 'entity' | 'icon' | 'code' | 'image';
	/** Defaults to the key, which Home Assistant's own strings cover for entity, icon and name. */
	label?: string;
	hint?: string;
	/** A literal sample value, such as an entity id or a URL. */
	placeholder?: string | ((values: FormValues) => string);
	/** A sample the reader would translate, such as a room name. */
	example?: string;
	/** Blocks Done while blank, naming the field in the reason. */
	required?: boolean;
	/** Names the field in that reason when the label is long. */
	shortLabel?: string;
	/** Replaces that reason when a label does not fit it at all, such as a plural. */
	reason?: string;
	domains?: string[];
	deviceClass?: string;
	/** A select's choices; an option without a label shows its value, such as a column count. */
	options?: { value: string; label?: string; params?: Record<string, string> }[];
	/**
	 * What a new or unset item starts with. For a select or a switch it is also
	 * stored as absent, so the type's own default applies.
	 */
	default?: RawValue;
	inputmode?: 'numeric' | 'decimal';
	/** number: round to a whole number. */
	integer?: boolean;
	/** number: smaller values are stored as absent. */
	min?: number;
	language?: 'yaml' | 'jinja2' | 'css';
	expectMapping?: boolean;
	/** Shown when typed text does not survive `write`; blocks Done. */
	invalid?: string;
	/** Behind the form's Advanced disclosure. */
	advanced?: boolean;
	/** Sits beside the previous field in one row, as an icon beside a name. */
	beside?: boolean;
	show?: (values: FormValues) => boolean;
	/** Stores nothing while hidden; otherwise a hidden field keeps what was typed. */
	clearHidden?: boolean;
	/** Overrides how the stored value becomes the control's value. */
	read?: (item: T | undefined) => RawValue;
	/** Overrides how the control's value is stored; undefined stores nothing. */
	write?: (raw: RawValue, values: FormValues, item: T | undefined) => unknown;
}

function readValue<T>(field: EditorField<T>, item: T | undefined): RawValue {
	if (field.read) return field.read(item);
	const stored = (item as Record<string, unknown> | undefined)?.[field.key];
	if (field.kind === 'check') {
		return typeof stored === 'boolean' ? stored : ((field.default as boolean) ?? false);
	}
	if (field.kind === 'list' && Array.isArray(stored)) return stored.join(', ');
	if (typeof stored === 'string' || typeof stored === 'number') return String(stored);
	return field.default ?? '';
}

function listFrom(text: string): string[] {
	return text
		.split(',')
		.map((entry) => entry.trim())
		.filter(Boolean);
}

function writeValue<T>(
	field: EditorField<T>,
	raw: RawValue,
	values: FormValues,
	item: T | undefined
): unknown {
	if (field.write) return field.write(raw, values, item);
	if (field.kind === 'check') return raw === (field.default ?? false) ? undefined : raw;
	const text = String(raw);
	switch (field.kind) {
		case 'select':
			return text === (field.default ?? '') ? undefined : text;
		case 'code':
			return text.trim() ? text : undefined;
		case 'list': {
			const list = listFrom(text);
			return list.length ? list : undefined;
		}
		case 'number': {
			const value = field.integer ? integerFromInput(text) : numberFromInput(text);
			return Number.isFinite(value) && (field.min === undefined || value >= field.min)
				? value
				: undefined;
		}
		default:
			return text.trim() || undefined;
	}
}

function blank(value: unknown): boolean {
	return value === undefined || value === '' || (Array.isArray(value) && !value.length);
}

/**
 * The state behind a FormRenderer: the controls' values, the fields they
 * store and Done's verdict. An editor with list rows of its own builds one
 * for its scalar options and adds the rows to `stored`.
 */
export class EditorForm<T> {
	readonly fields: EditorField<T>[];
	values: FormValues = $state({});
	#item: T | undefined;
	#lang = fromStore(lang);

	/** Whether the Advanced disclosure starts open: one of its fields holds a value of its own. */
	readonly customized: boolean;

	constructor(item: T | undefined, fields: EditorField<T>[]) {
		this.#item = item;
		this.fields = fields;
		this.values = Object.fromEntries(fields.map((field) => [field.key, readValue(field, item)]));
		this.customized = fields.some((field) => {
			if (!field.advanced) return false;
			const fresh = readValue(field, undefined);
			const stored = writeValue(field, this.values[field.key], this.values, item);
			return JSON.stringify(stored) !== JSON.stringify(writeValue(field, fresh, {}, undefined));
		});
	}

	shown(field: EditorField<T>): boolean {
		return field.show?.(this.values) ?? true;
	}

	/** The fields as the item stores them; only these keys, so the sheet keeps the rest. */
	stored: Partial<T> = $derived.by(() => {
		const stored: Record<string, unknown> = {};
		for (const field of this.fields) {
			stored[field.key] =
				field.clearHidden && !this.shown(field)
					? undefined
					: writeValue(field, this.values[field.key], this.values, this.#item);
		}
		return stored as Partial<T>;
	});

	/** The translation key of the message for typed text that does not survive storing. */
	issue(field: EditorField<T>): string | undefined {
		const raw = this.values[field.key];
		if (!field.invalid || typeof raw !== 'string' || !raw.trim()) return undefined;
		return this.stored[field.key] === undefined ? field.invalid : undefined;
	}

	/** A malformed value explains itself under its field, so Done gives the generic reason. */
	validity: Validity = $derived.by(() => {
		const t = this.#lang.current;
		if (this.fields.some((field) => this.shown(field) && this.issue(field)))
			return { valid: false };
		return requireFields(
			t('hearth_field_required'),
			...this.fields
				.filter((field) => field.required)
				.map((field) => ({
					label: t(field.shortLabel ?? field.label ?? field.key),
					value: blank(this.stored[field.key]) ? '' : field.key,
					reason: field.reason && t(field.reason)
				}))
		);
	});
}
