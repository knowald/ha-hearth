import * as v from 'valibot';
import { toJsonSchema, type JsonSchema } from '@valibot/to-json-schema';
import { CONFIG_VERSION } from '$lib/Hearth/format';
import { AlertRuleSchema } from '$lib/Hearth/model/alerts';
import { CARD_DEFINITIONS, WIDGET_DEFINITIONS } from '$lib/Hearth/model/registry';
import {
	CardSharedSchema,
	RoomSchema,
	RootSettingsSchema,
	StackSchema,
	WidgetSharedSchema
} from '$lib/Hearth/schema';

/*
 * A JSON Schema of hearth.yaml for agents and YAML editors, assembled from the
 * valibot schemas the server validates with. Checks JSON Schema cannot express
 * (unique ids, theme values, cross-field rules) are left out, so a document
 * that passes it can still fail hearthConfigIssues; /_api/agent/validate has
 * the final word.
 */

/**
 * Each conversion numbers its own `$defs` (for v.lazy) from 0, so they are
 * renamed apart here and collected under the root's `definitions`.
 */
function converter(definitions: Record<string, JsonSchema>) {
	let conversions = 0;
	return (schema: v.GenericSchema): JsonSchema => {
		const prefix = `lazy${conversions++}_`;
		const rename = (value: unknown): unknown => {
			if (Array.isArray(value)) return value.map(rename);
			if (!value || typeof value !== 'object') return value;
			return Object.fromEntries(
				Object.entries(value).map(([key, entry]) => [
					key,
					key === '$ref' && typeof entry === 'string'
						? entry.replace('#/$defs/', `#/definitions/${prefix}`)
						: rename(entry)
				])
			);
		};
		const rest = toJsonSchema(schema, { errorMode: 'ignore' }) as JsonSchema & {
			$defs?: Record<string, JsonSchema>;
		};
		const { $defs } = rest;
		delete rest.$schema;
		delete rest.$defs;
		for (const [name, definition] of Object.entries($defs ?? {})) {
			definitions[prefix + name] = rename(definition) as JsonSchema;
		}
		return rename(rest) as JsonSchema;
	};
}

let convert: (schema: v.GenericSchema) => JsonSchema;

const Id: JsonSchema = { type: 'string', minLength: 1, description: 'Unique among its kind' };

/** Each card and widget type's own fields, as `when` adds them to the schema. */
const typeSchemas = new Map<string, JsonSchema>();

/** `then` applies only to the item whose `key` is `value`. */
function when(key: string, value: string, then: JsonSchema): JsonSchema {
	return { if: { properties: { [key]: { const: value } }, required: [key] }, then };
}

function cardSchema(): JsonSchema {
	return {
		type: 'object',
		required: ['id', 'type'],
		properties: { id: Id, type: { enum: CARD_DEFINITIONS.map(({ type }) => type) } },
		allOf: [
			convert(CardSharedSchema),
			...CARD_DEFINITIONS.map(({ type, schema }) => {
				typeSchemas.set(`card:${type}`, convert(schema));
				return when('type', type, typeSchemas.get(`card:${type}`)!);
			})
		]
	};
}

function stackSchema(card: JsonSchema): JsonSchema {
	return {
		type: 'object',
		required: ['id', 'kind', 'cards'],
		properties: {
			id: Id,
			kind: { const: 'stack' },
			cards: { type: 'array', items: card, description: 'Cards side by side; no nested stacks' }
		},
		allOf: [convert(StackSchema)]
	};
}

function widgetSchema(): JsonSchema {
	return {
		type: 'object',
		required: ['id', 'type'],
		properties: { id: Id, type: { enum: WIDGET_DEFINITIONS.map(({ type }) => type) } },
		allOf: [
			convert(WidgetSharedSchema),
			...WIDGET_DEFINITIONS.map(({ type, schema }) => {
				typeSchemas.set(`widget:${type}`, convert(schema));
				return when('type', type, typeSchemas.get(`widget:${type}`)!);
			})
		]
	};
}

let built: JsonSchema | undefined;

export function hearthJsonSchema(): JsonSchema {
	if (built) return built;
	const definitions: Record<string, JsonSchema> = {};
	convert = converter(definitions);
	definitions.card = cardSchema();
	definitions.stack = stackSchema({ $ref: '#/definitions/card' });
	const schema: JsonSchema = {
		$schema: 'http://json-schema.org/draft-07/schema#',
		title: 'Hearth dashboard (hearth.yaml)',
		type: 'object',
		required: ['version', 'rooms', 'rail'],
		definitions,
		properties: {
			version: { const: CONFIG_VERSION },
			revision: {
				type: 'integer',
				description: 'Managed by the server. Leave it as it is; it is replaced on save.'
			},
			rail: { type: 'array', description: 'Sidebar widgets', items: widgetSchema() },
			rooms: {
				type: 'array',
				description: 'Pages',
				items: {
					type: 'object',
					required: ['id', 'cards'],
					properties: {
						id: Id,
						cards: {
							type: 'array',
							description: 'Columns, each a list of cards and stacks',
							items: {
								type: 'array',
								items: {
									if: { properties: { kind: { const: 'stack' } }, required: ['kind'] },
									then: { $ref: '#/definitions/stack' },
									else: { $ref: '#/definitions/card' }
								}
							}
						}
					},
					allOf: [convert(RoomSchema)]
				}
			},
			alerts: {
				type: 'array',
				items: {
					type: 'object',
					required: ['id'],
					properties: { id: Id },
					allOf: [convert(AlertRuleSchema)]
				}
			}
		},
		allOf: [convert(RootSettingsSchema)]
	};
	built = schema;
	return built;
}

/** The `#/definitions/...` names `value` refers to, and the ones those refer to in turn. */
function referencedDefinitions(value: unknown, into = new Set<string>()): Set<string> {
	if (Array.isArray(value)) value.forEach((entry) => referencedDefinitions(entry, into));
	else if (value && typeof value === 'object') {
		for (const [key, entry] of Object.entries(value)) {
			if (key === '$ref' && typeof entry === 'string' && entry.startsWith('#/definitions/')) {
				const name = entry.slice('#/definitions/'.length);
				if (!into.has(name)) {
					into.add(name);
					referencedDefinitions(hearthJsonSchema().definitions?.[name], into);
				}
			} else referencedDefinitions(entry, into);
		}
	}
	return into;
}

function withDefinitions(schema: JsonSchema): JsonSchema {
	const all = hearthJsonSchema().definitions ?? {};
	const names = [...referencedDefinitions(schema)];
	return names.length
		? { ...schema, definitions: Object.fromEntries(names.map((name) => [name, all[name]])) }
		: schema;
}

/**
 * The fields of one card or widget type, beyond the shared ones in the
 * outline, or undefined for a type Hearth does not have.
 */
export function typeJsonSchema(kind: 'card' | 'widget', type: string): JsonSchema | undefined {
	hearthJsonSchema();
	const schema = typeSchemas.get(`${kind}:${type}`);
	return schema && withDefinitions(schema);
}

/** The schema without the per-type fields, which typeJsonSchema serves one at a time. */
export function outlineJsonSchema(): JsonSchema {
	const strip = (value: unknown): unknown => {
		if (Array.isArray(value)) return value.map(strip);
		if (!value || typeof value !== 'object') return value;
		const record = value as Record<string, unknown>;
		const condition = record.if as { properties?: { type?: unknown } } | undefined;
		// a per-type `when` block: keep the condition, drop the fields
		if (condition?.properties?.type && record.then) return undefined;
		return Object.fromEntries(
			Object.entries(record).map(([key, entry]) => [
				key,
				Array.isArray(entry) ? entry.map(strip).filter((item) => item !== undefined) : strip(entry)
			])
		);
	};
	return strip(hearthJsonSchema()) as JsonSchema;
}
