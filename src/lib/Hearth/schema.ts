import * as v from 'valibot';
import type { ActionTarget, HaAction } from '$lib/core/ha/commands';
import { isLinkUrl, isTileUrl, RADAR_ZOOM } from './config';

/*
 * Field-level schemas for the shapes that recur across card and widget types.
 * The TypeScript types in types.ts derive from these, so a change here is a
 * change everywhere. Messages read as the tail of an issue line, after the
 * path: "rooms[0].cards[0][1].entities[0].entity must be a non-empty string".
 */

export const EntityIdSchema = v.pipe(
	v.string('must be a non-empty string'),
	v.trim(),
	v.minLength(1, 'must be a non-empty string')
);

export const OptionalText = v.optional(v.string('must be text'));
export const OptionalEntityId = v.optional(EntityIdSchema);
export const OptionalFlag = v.optional(v.boolean('must be true or false'));
const FiniteNumber = v.pipe(v.number('must be a number'), v.finite('must be a finite number'));
export const OptionalNumber = v.optional(FiniteNumber);
export const OptionalTextList = v.optional(v.array(v.string('must be text'), 'must be a list'));
export const OptionalEntityIdList = v.optional(
	v.array(EntityIdSchema, 'must be a list of entity ids')
);

export function optionalNumberAtLeast(min: number) {
	return v.optional(v.pipe(FiniteNumber, v.minValue(min, `must be at least ${min}`)));
}

/** An optional number from min to max inclusive. */
export function optionalNumberInRange(min: number, max: number) {
	const message = `must be ${min} to ${max}`; // copy ok: yaml diagnostic
	return v.optional(v.pipe(FiniteNumber, v.minValue(min, message), v.maxValue(max, message)));
}

/** A card or widget height in px, matching normalizeHeight. */
export const HeightSchema = optionalNumberAtLeast(40);

/** YAML reads `active_state: on` as a boolean and `duration: 48` as a number; both are text here. */
const ScalarText = v.pipe(
	v.union([v.string(), v.number(), v.boolean()], 'must be text'),
	v.transform((value) => String(value))
);
const TextFromScalar = v.optional(ScalarText);

/**
 * Ascending comfort thresholds for a numeric sensor: below `good` reads GOOD,
 * below `fair` reads FAIR, else POOR. `max` scales the banded track and
 * defaults to 1.5x `fair`.
 */
export const VerdictBandsSchema = v.pipe(
	v.object({
		good: v.number('must be a number'),
		fair: v.number('must be a number'),
		max: v.optional(v.number('must be a number'))
	}),
	v.check((bands) => bands.good < bands.fair, 'good must be below fair')
);

function isMapping(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

const ACTION_KINDS = [
	'default',
	'toggle',
	'more-info',
	'perform-action',
	// Lovelace's name for perform-action before Home Assistant 2024.8
	'call-service',
	'navigate',
	'url',
	'none'
] as const;

const ServiceNameSchema = v.pipe(
	v.string('must be a domain.service name'),
	v.trim(),
	v.regex(/^[a-z0-9_]+\.[a-z0-9_]+$/, 'must be a domain.service name, like script.turn_on')
);

const ActionDataSchema = v.custom<Record<string, unknown>>(isMapping, 'must be a mapping');

const TargetIdsSchema = v.optional(
	v.union([EntityIdSchema, v.array(EntityIdSchema)], 'must be an id or a list of ids')
);

const ActionTargetSchema = v.object({
	entity_id: TargetIdsSchema,
	device_id: TargetIdsSchema,
	area_id: TargetIdsSchema,
	floor_id: TargetIdsSchema,
	label_id: TargetIdsSchema
});

/** Drops empty target keys; nothing left means no target. */
function compactTarget(raw: v.InferOutput<typeof ActionTargetSchema> | undefined) {
	const entries = Object.entries(raw ?? {}).filter(
		([, ids]) => ids !== undefined && (!Array.isArray(ids) || ids.length > 0)
	);
	return entries.length ? (Object.fromEntries(entries) as ActionTarget) : undefined;
}

/**
 * A tap or hold action, in Lovelace's own shape so one pasted from a Home
 * Assistant card works: `call-service`, `service` and `service_data` are read
 * as `perform-action`, `perform_action` and `data`.
 */
export const ActionSchema = v.pipe(
	v.object({
		action: v.picklist(
			ACTION_KINDS,
			'must be default, toggle, more-info, perform-action, navigate, url or none'
		),
		entity: OptionalEntityId,
		perform_action: v.optional(ServiceNameSchema),
		service: v.optional(ServiceNameSchema),
		target: v.optional(ActionTargetSchema),
		data: v.optional(ActionDataSchema),
		service_data: v.optional(ActionDataSchema),
		navigation_path: v.optional(
			v.pipe(v.string('must be text'), v.trim(), v.minLength(1, 'must not be empty'))
		),
		url_path: v.optional(
			v.pipe(
				v.string('must be text'),
				v.trim(),
				v.check(isLinkUrl, 'must be an http(s) URL or a path on this host')
			)
		),
		confirmation: v.optional(
			v.union(
				[v.boolean(), v.object({ text: OptionalText })],
				'must be true, false or a mapping with text'
			)
		)
	}),
	v.check(
		(raw) =>
			(raw.action !== 'perform-action' && raw.action !== 'call-service') ||
			Boolean(raw.perform_action ?? raw.service),
		'needs perform_action for perform-action'
	),
	v.check(
		(raw) => raw.action !== 'navigate' || Boolean(raw.navigation_path),
		'needs navigation_path for navigate'
	),
	v.check((raw) => raw.action !== 'url' || Boolean(raw.url_path), 'needs url_path for url'),
	v.transform((raw): HaAction => {
		const text = isMapping(raw.confirmation) ? raw.confirmation.text?.trim() : undefined;
		const confirmation = text ? { text } : raw.confirmation ? (true as const) : undefined;
		switch (raw.action) {
			case 'perform-action':
			case 'call-service': {
				const data = { ...raw.service_data, ...raw.data };
				return {
					action: 'perform-action',
					perform_action: (raw.perform_action ?? raw.service)!,
					target: compactTarget(raw.target),
					data: Object.keys(data).length ? data : undefined,
					confirmation
				};
			}
			case 'navigate':
				return { action: 'navigate', navigation_path: raw.navigation_path!, confirmation };
			case 'url':
				return { action: 'url', url_path: raw.url_path!, confirmation };
			case 'toggle':
			case 'more-info':
				return { action: raw.action, entity: raw.entity, confirmation };
			default:
				return { action: raw.action, confirmation };
		}
	})
);

export const EntityRefSchema = v.object({
	entity: EntityIdSchema,
	name: OptionalText,
	icon: OptionalText,
	// per-entity presentation; falls back to the card's style when unset
	display: v.optional(v.picklist(['tile', 'stat'], 'must be tile or stat')),
	// display-only tile, for entities whose integration exposes no working
	// toggle (a PlayStation media_player, a read-only sensor)
	readonly: v.optional(v.boolean('must be true or false')),
	// tile highlight: lit while active_entity (the tile's own entity when
	// omitted) holds one of active_states; the tile keeps its own label, state
	// and detail view
	active_entity: OptionalEntityId,
	active_states: v.optional(v.array(ScalarText, 'must be a list')),
	// overrides the containing entities card's slider update behavior
	slider_updates: v.optional(
		v.picklist(['continuous', 'release'], 'must be continuous or release')
	),
	// stat readouts judge known air sensors by device_class; false suppresses
	// that, custom bands extend it to any ascending numeric sensor
	verdict: v.optional(v.union([v.literal(false), VerdictBandsSchema], 'must be false or bands')),
	// unset is the tile's own behaviour for its domain
	tap_action: v.optional(ActionSchema),
	hold_action: v.optional(ActionSchema)
});

// the tile highlight fields mean something else on scenes and nothing on
// modes, and neither takes configured actions
const RefSchema = v.omit(EntityRefSchema, [
	'active_entity',
	'active_states',
	'tap_action',
	'hold_action'
]);

export const SceneRefSchema = v.object({
	...RefSchema.entries,
	// small caption under the name in the scene bar, replaced by "active" while
	// this scene is the active one
	caption: OptionalText,
	// marks the scene active while this entity holds active_state ('on' when
	// omitted); without it activity comes from which listed scene was applied
	// most recently
	active_entity: OptionalEntityId,
	active_state: TextFromScalar
});

export const VacuumModeRefSchema = v.object({
	...RefSchema.entries,
	// what the mode covers, so a one-tap run is safe to commit to without
	// opening the vacuum app first
	detail: OptionalText,
	// expected run time, shown next to the detail
	duration: TextFromScalar,
	// tags the mode as the recommended one. It stays the same size and costs
	// the same single tap as the rest; the tag is the only difference
	default: v.optional(v.boolean('must be true or false'))
});

/**
 * Per-item visibility condition:
 * an entity state match, a numeric window on an entity, a media query, or an
 * `or` group of conditions. All conditions on an item AND together.
 */
export type VisibilityConditionInput =
	| { entity: string; state?: string; state_not?: string; above?: number; below?: number }
	| { media: string }
	| { or: VisibilityConditionInput[] };

export const VisibilityConditionSchema: v.GenericSchema<VisibilityConditionInput> = v.lazy(() =>
	v.union(
		[
			v.object({
				entity: EntityIdSchema,
				state: OptionalText,
				state_not: OptionalText,
				above: v.optional(v.number('must be a number')),
				below: v.optional(v.number('must be a number'))
			}),
			v.object({ media: v.string('must be a media query') }),
			v.object({ or: v.array(VisibilityConditionSchema, 'must be a list of conditions') })
		],
		'must name an entity, a media query or an or-group'
	)
);

/** Selects the night theme from a Home Assistant entity state. */
export const DayNightSwitchSchema = v.object({
	entity: EntityIdSchema,
	night_state: OptionalText
});

/** A one-tap Spotify shortcut on the media card. */
export const MediaShortcutSchema = v.object({
	name: v.pipe(v.string('must be text'), v.trim(), v.minLength(1, 'must not be empty')),
	uri: v.pipe(
		v.string('must be a Spotify URI'),
		v.trim(),
		v.startsWith('spotify:', 'must be a Spotify URI')
	),
	image_url: OptionalText
});

/** A list of entity references, as cards keep them. */
export const EntityRefListSchema = v.array(EntityRefSchema, 'must be a list');

export const VisibilityListSchema = v.optional(
	v.array(VisibilityConditionSchema, 'must be a list of conditions')
);

/** Fields every card carries besides its type's own; the type schema covers the rest. */
export const CardSharedSchema = v.looseObject({
	visibility: VisibilityListSchema,
	fill: optionalNumberAtLeast(0),
	height: HeightSchema
});

export const WidgetSharedSchema = v.looseObject({
	mobile: v.optional(v.picklist(['top', 'bottom', 'hidden'], 'must be top, bottom or hidden')),
	hide_mobile: OptionalFlag,
	side: v.optional(v.picklist(['left', 'right'], 'must be left or right')),
	visibility: VisibilityListSchema
});

export const StackSchema = v.looseObject({
	title: OptionalText,
	direction: v.optional(v.picklist(['horizontal', 'vertical'], 'must be horizontal or vertical')),
	fill: optionalNumberAtLeast(0)
});

export const RoomSchema = v.looseObject({
	name: OptionalText,
	icon: OptionalText,
	summary: OptionalText,
	temp_entity: OptionalEntityId,
	humidity_entity: OptionalEntityId,
	hide_header: OptionalFlag,
	fill_screen: OptionalFlag,
	columns: v.optional(
		v.pipe(
			v.number('must be a number'),
			v.integer('must be a whole number'),
			v.minValue(1, 'must be 1 to 3'),
			v.maxValue(3, 'must be 1 to 3')
		)
	)
});

// v.record alone accepts arrays, which are objects to it
const ThemeSchema = v.pipe(
	v.custom<Record<string, unknown>>(
		(value) => !!value && typeof value === 'object' && !Array.isArray(value),
		'must be a mapping of tokens'
	),
	v.record(v.string(), v.string('must be text'))
);

/** Root settings; `rail` and `rooms` are walked item by item by the issue checker. */
export const RootSettingsSchema = v.looseObject({
	theme: v.optional(ThemeSchema),
	theme_night: v.optional(ThemeSchema),
	day_night: v.optional(DayNightSwitchSchema),
	rail_position: v.optional(
		v.picklist(['left', 'right', 'both', 'none'], 'must be left, right, both or none')
	),
	screensaver_minutes: optionalNumberAtLeast(1),
	screensaver_drift: OptionalFlag,
	screensaver_brightness: optionalNumberInRange(10, 100),
	screensaver_background: v.optional(
		v.picklist(['none', 'image', 'radar'], 'must be none, image or radar')
	),
	screensaver_image: OptionalText,
	screensaver_radar: v.optional(
		v.object({
			latitude: optionalNumberInRange(-90, 90),
			longitude: optionalNumberInRange(-180, 180),
			zoom: optionalNumberInRange(RADAR_ZOOM.min, RADAR_ZOOM.max),
			basemap: v.optional(v.picklist(['dark', 'light'], 'must be dark or light')),
			tile_url: v.optional(
				v.pipe(
					v.string('must be text'),
					v.check(isTileUrl, 'must be an http(s) URL with {z}, {x} and {y}')
				)
			),
			attribution: OptionalText
		})
	),
	screensaver_show_date: OptionalFlag,
	screensaver_clock_size: v.optional(
		v.picklist(['small', 'medium', 'large'], 'must be small, medium or large')
	),
	screensaver_weather_entity: OptionalEntityId,
	keep_screen_on: OptionalFlag,
	edit_lock: v.optional(v.picklist(['hold', 'pin'], 'must be hold or pin')),
	// YAML reads an unquoted 0815 as the number 815, so only quoted text is a PIN
	edit_pin: v.optional(
		v.pipe(
			v.string("must be quoted, like '0815': unquoted, YAML drops leading zeros"),
			v.regex(/^\d{4,8}$/, 'must be 4 to 8 digits')
		)
	),
	scroll_edge_blur: OptionalFlag,
	swipe_navigation_mobile: OptionalFlag,
	swipe_navigation_desktop: OptionalFlag,
	phone_clock: OptionalFlag,
	padding_x: optionalNumberAtLeast(0),
	padding_y: optionalNumberAtLeast(0),
	mobile_padding_x: optionalNumberAtLeast(0),
	mobile_padding_y: optionalNumberAtLeast(0),
	scale: optionalNumberInRange(50, 200),
	mobile_scale: optionalNumberInRange(50, 200)
});

/**
 * Formats a valibot issue as "path suffix message", with array indices in
 * brackets so it reads like the rest of the editor's issue lines.
 */
export function issueLines(issues: v.BaseIssue<unknown>[], prefix: string): string[] {
	return issues.map((issue) => {
		const path = (issue.path ?? [])
			.map((segment) => (typeof segment.key === 'number' ? `[${segment.key}]` : `.${segment.key}`))
			.join('');
		// a missing required key surfaces as an object issue on that key
		const message = issue.message.startsWith('Invalid key:') ? 'is required' : issue.message;
		// root-level issues have no prefix, so the path loses its leading dot
		return `${prefix}${prefix ? path : path.replace(/^\./, '')} ${message}`;
	});
}
