import { derived, get, type Readable } from 'svelte/store';
import { minuteTimer } from '$lib/core/app/clock';
import { deviceName } from '$lib/core/app/device';
import { sensorNumber } from '$lib/core/ha/entities';
import type { HassEntities } from 'home-assistant-js-websocket';
import {
	mobileSlotOf,
	railDividerIndex,
	WEEKDAYS,
	type RailWidget,
	type StyleRule,
	type VisibilityCondition,
	type Weekday
} from './config';

/**
 * Evaluates a list of visibility conditions (ANDed together) against current
 * entity states and already-resolved media query matches.
 *
 * Missing-entity semantics: an entity condition fails whenever the entity
 * does not exist in $states, for both `state` and `state_not` - a missing
 * entity is treated as "unknown", not as satisfying "not equal to X".
 */
export function evaluateVisibility(
	conditions: VisibilityCondition[] | undefined,
	$states: HassEntities | undefined,
	mediaMatches: Record<string, boolean>,
	context: VisibilityContext = {}
): boolean {
	if (!conditions || conditions.length === 0) return true;
	return conditions.every((condition) =>
		evaluateCondition(condition, $states, mediaMatches, context)
	);
}

/** What conditions read besides states and media queries. */
export interface VisibilityContext {
	/** This screen's device name (core/app/device.ts); unset matches no device condition. */
	device?: string;
	/** The time to judge time conditions by; unset is the current time. */
	now?: Date;
}

function minutesOf(time: string): number {
	const [hours, minutes] = time.split(':').map(Number);
	return hours * 60 + minutes;
}

/**
 * Whether `now` falls in the window: from `after` up to, not including,
 * `before`. An `after` later than `before` is a window across midnight, and
 * its early-morning part belongs to the day it started on, so a Friday
 * 22:00 to 06:00 window still holds at 02:00 on Saturday.
 */
export function inTimeWindow(
	time: { after?: string; before?: string; weekdays?: readonly Weekday[] },
	now: Date
): boolean {
	const current = now.getHours() * 60 + now.getMinutes();
	const after = time.after ? minutesOf(time.after) : undefined;
	const before = time.before ? minutesOf(time.before) : undefined;
	let started = now.getDay();
	if (after !== undefined && before !== undefined && after > before) {
		if (current >= before && current < after) return false;
		if (current < before) started = (started + 6) % 7;
	} else {
		if (after !== undefined && current < after) return false;
		if (before !== undefined && current >= before) return false;
	}
	// getDay counts from Sunday, WEEKDAYS from Monday
	return !time.weekdays?.length || time.weekdays.includes(WEEKDAYS[(started + 6) % 7]);
}

function deviceMatches(target: string | string[], device: string | undefined): boolean {
	const name = device?.trim();
	if (!name) return false;
	return (Array.isArray(target) ? target : [target]).some((entry) => entry.trim() === name);
}

/** A numeric reading of a state or attribute, as a sensor would show it. */
function numberOf(value: unknown): number | null {
	if (typeof value === 'number') return Number.isFinite(value) ? value : null;
	return typeof value === 'string' ? sensorNumber(value) : null;
}

function evaluateCondition(
	condition: VisibilityCondition,
	$states: HassEntities | undefined,
	mediaMatches: Record<string, boolean>,
	context: VisibilityContext
): boolean {
	if ('media' in condition) {
		return mediaMatches[condition.media] ?? false;
	}
	if ('or' in condition) {
		return condition.or.some((nested) => evaluateCondition(nested, $states, mediaMatches, context));
	}
	if ('device' in condition) return deviceMatches(condition.device, context.device);
	if ('time' in condition) return inTimeWindow(condition.time, context.now ?? new Date());

	const entity = $states?.[condition.entity];
	if (entity === undefined) return false;
	const raw: unknown =
		condition.attribute === undefined ? entity.state : entity.attributes?.[condition.attribute];
	// a missing attribute is unknown, the same as a missing entity
	if (raw === undefined || raw === null) return false;
	const entityState = String(raw);

	if (typeof condition.state === 'string') return entityState === condition.state;
	if (typeof condition.state_not === 'string') return entityState !== condition.state_not;
	if (typeof condition.above === 'number' || typeof condition.below === 'number') {
		const value = numberOf(raw);
		if (value === null) return false;
		if (typeof condition.above === 'number' && !(value > condition.above)) return false;
		if (typeof condition.below === 'number' && !(value < condition.below)) return false;
		return true;
	}

	// neither constraint set: condition just checks the entity is known
	return true;
}

export function mediaQueriesIn(conditions: VisibilityCondition[]): string[] {
	return conditions.flatMap((condition) =>
		'media' in condition ? [condition.media] : 'or' in condition ? mediaQueriesIn(condition.or) : []
	);
}

// user-entered queries can be malformed css, and jsdom has no matchMedia at all
function liveMediaMatch(query: string): boolean {
	try {
		return typeof window !== 'undefined' && (window.matchMedia?.(query).matches ?? false);
	} catch {
		return false;
	}
}

export function usesTime(conditions: VisibilityCondition[] | undefined): boolean {
	return (conditions ?? []).some(
		(condition) => 'time' in condition || ('or' in condition && usesTime(condition.or))
	);
}

/**
 * The minute clock while `conditions` hold a time condition, otherwise
 * undefined, so nothing ticks for conditions that never read the time.
 */
export function clockFor(
	conditions: Readable<VisibilityCondition[] | undefined>
): Readable<Date | undefined> {
	return derived(conditions, ($conditions, set) => {
		if (!usesTime($conditions)) {
			set(undefined);
			return;
		}
		return minuteTimer.subscribe(set);
	});
}

/**
 * Evaluates conditions outside a component, for alert rules, against this
 * screen's device name and the current time. Media queries never hold here:
 * alert rules cannot use them (see model/alerts.ts).
 */
export function conditionsHold(
	conditions: VisibilityCondition[],
	$states: HassEntities | undefined
): boolean {
	return evaluateVisibility(conditions, $states, {}, { device: get(deviceName) });
}

/** The first style rule whose conditions hold, which is the one a tile wears. */
export function matchStyleRule(
	rules: StyleRule[] | undefined,
	$states: HassEntities | undefined,
	context: VisibilityContext
): StyleRule | undefined {
	return rules?.find((rule) => evaluateVisibility(rule.conditions, $states, {}, context));
}

const COLOR_TOKENS: Record<string, string> = {
	accent: 'var(--h-accent-icon)',
	cool: 'var(--h-cool-icon)',
	good: 'var(--h-good)',
	bad: 'var(--h-bad-text)'
};

/**
 * A style rule's color as a CSS value: a theme token name, or a color the
 * browser parses itself. Text that cannot be a color is dropped, so a rule
 * can never write past the one property it sets.
 */
export function styleColor(color: string | undefined): string | undefined {
	const value = color?.trim().toLowerCase();
	if (!value) return undefined;
	if (COLOR_TOKENS[value]) return COLOR_TOKENS[value];
	return /^(#[0-9a-f]{3,8}|[a-z]+|(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\([\d\s.,%/+-]*\))$/.test(
		value
	)
		? value
		: undefined;
}

/**
 * Whether the rail currently shows a widget of `type`: its visibility
 * conditions hold and, while the rail is folded (`narrow`), it is not hidden
 * on mobile. Media conditions are read from the live window unless `match`
 * says otherwise.
 */
export function railWidgetShown(
	rail: RailWidget[],
	type: RailWidget['type'],
	$states: HassEntities | undefined,
	{ narrow, match = liveMediaMatch }: { narrow: boolean; match?: (query: string) => boolean }
): boolean {
	const dividerIndex = railDividerIndex(rail);
	return rail.some((widget, index) => {
		if (widget.type !== type) return false;
		if (narrow && mobileSlotOf(widget, index, dividerIndex) === 'hidden') return false;
		const queries = mediaQueriesIn(widget.visibility ?? []);
		const mediaMatches = Object.fromEntries(queries.map((query) => [query, match(query)]));
		return evaluateVisibility(widget.visibility, $states, mediaMatches, {
			device: get(deviceName)
		});
	});
}

/**
 * The one rule for whether search exists: the f shortcut, the page
 * switcher's button and the rail widget all follow a search widget the user
 * can currently see.
 */
export function searchAvailable(
	rail: RailWidget[],
	$states: HassEntities | undefined,
	narrow: boolean,
	match?: (query: string) => boolean
): boolean {
	return railWidgetShown(rail, 'search', $states, { narrow, match });
}
