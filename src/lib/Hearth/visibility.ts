import { derived, get, type Readable } from 'svelte/store';
import { minuteTimer } from '$lib/core/app/clock';
import { deviceName } from '$lib/core/app/device';
import { sensorNumber } from '$lib/core/ha/entities';
import type { HassEntities } from 'home-assistant-js-websocket';
import { displayTimeZone } from './store';
import {
	CLOCK_TIME,
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
	/** The IANA zone time conditions are read in, as the clocks show it; unset is the browser's. */
	timeZone?: string;
}

type TimeWindow = { after?: string; before?: string; weekdays?: readonly Weekday[] };

function minutesOf(time: string): number {
	const [hours, minutes] = time.split(':').map(Number);
	return hours * 60 + minutes;
}

const clockFormats = new Map<string, Intl.DateTimeFormat>();

/** The wall clock in `timeZone`: minutes into the day, seconds and the weekday. */
export function wallClock(
	now: Date,
	timeZone?: string
): { minutes: number; seconds: number; day: Weekday } {
	let format = clockFormats.get(timeZone ?? '');
	if (!format) {
		format = new Intl.DateTimeFormat('en-US', {
			hour: 'numeric',
			minute: 'numeric',
			second: 'numeric',
			weekday: 'short',
			hourCycle: 'h23',
			...(timeZone ? { timeZone } : {})
		});
		clockFormats.set(timeZone ?? '', format);
	}
	const parts = Object.fromEntries(
		format.formatToParts(now).map(({ type, value }) => [type, value])
	);
	return {
		minutes: Number(parts.hour) * 60 + Number(parts.minute),
		seconds: Number(parts.second),
		day: parts.weekday.toLowerCase() as Weekday
	};
}

// a window with nothing usable in it holds never, rather than always
function usableWindow(time: TimeWindow): boolean {
	const times = [time.after, time.before].filter((value) => value !== undefined);
	return (
		times.every((value) => CLOCK_TIME.test(value)) &&
		(time.weekdays ?? []).every((day) => WEEKDAYS.includes(day)) &&
		(times.length > 0 || (time.weekdays?.length ?? 0) > 0)
	);
}

/**
 * Whether `now` falls in the window: from `after` up to, not including,
 * `before`, read on the clock of `timeZone`. The same time for both is the
 * whole day. An `after` later than `before` is a window across midnight, and
 * its early-morning part belongs to the day it started on, so a Friday
 * 22:00 to 06:00 window still holds at 02:00 on Saturday.
 */
export function inTimeWindow(time: TimeWindow, now: Date, timeZone?: string): boolean {
	if (!usableWindow(time)) return false;
	const { minutes: current, day } = wallClock(now, timeZone);
	const after = time.after ? minutesOf(time.after) : undefined;
	const before = time.before ? minutesOf(time.before) : undefined;
	let started = WEEKDAYS.indexOf(day);
	if (after !== undefined && after === before) {
		// the whole day
	} else if (after !== undefined && before !== undefined && after > before) {
		if (current >= before && current < after) return false;
		if (current < before) started = (started + 6) % 7;
	} else {
		if (after !== undefined && current < after) return false;
		if (before !== undefined && current >= before) return false;
	}
	return !time.weekdays?.length || time.weekdays.includes(WEEKDAYS[started]);
}

/**
 * The longest the conditions other than entity states can have held at
 * `now`, in ms: a time window since it opened, Infinity when only entity
 * states are involved, and 0 where it cannot be told (a device name, or an
 * or-group that reads more than states).
 */
export function heldAtMost(
	conditions: VisibilityCondition[],
	now: Date,
	timeZone?: string
): number {
	const limits = conditions.map((condition) => {
		if ('entity' in condition) return Infinity;
		if ('or' in condition) return condition.or.every((nested) => 'entity' in nested) ? Infinity : 0;
		if ('time' in condition) {
			const { after, before } = condition.time;
			const { minutes, seconds } = wallClock(now, timeZone);
			// without an after, or with the whole day, the window opened at midnight
			const opened = after && after !== before ? minutesOf(after) : 0;
			return (((minutes - opened + 1440) % 1440) * 60 + seconds) * 1000;
		}
		return 0;
	});
	return Math.min(Infinity, ...limits);
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
	if ('time' in condition)
		return inTimeWindow(condition.time, context.now ?? new Date(), context.timeZone);

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
	return evaluateVisibility(conditions, $states, {}, visibilityContext());
}

/** heldAtMost for alert rules: now, on this screen's display clock. */
export function conditionsHeldAtMost(conditions: VisibilityCondition[]): number {
	return heldAtMost(conditions, new Date(), get(displayTimeZone));
}

/** This screen's device name and display time zone, as conditions read them right now. */
export function visibilityContext(): VisibilityContext {
	return { device: get(deviceName), timeZone: get(displayTimeZone) };
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
	// the shape check runs first even where the browser can judge, so no
	// var() or other function reaches the property
	const shaped =
		/^(#[0-9a-f]{3,8}|[a-z]+|(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\([\d\s.,%/+-]*\))$/.test(
			value
		);
	if (!shaped) return undefined;
	if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
		return CSS.supports('color', value) ? value : undefined;
	}
	return value;
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
		return evaluateVisibility(widget.visibility, $states, mediaMatches, visibilityContext());
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
