import * as v from 'valibot';
import type { OverviewCard } from '../../types';
import { isRecord, trimmedOrUndefined } from '../../normalizers';
import type { CardDefinition } from '../types';
import { inDomains } from './draft';
import { OptionalEntityId, OptionalFlag, OptionalNumber, OptionalText } from '../../schema';

export type GaugeCard = Extract<OverviewCard, { type: 'gauge' }>;
export type GaugeSegment = NonNullable<GaugeCard['segments']>[number];

export const GAUGE_MIN = 0;
export const GAUGE_MAX = 100;

const GaugeSegmentSchema = v.object({
	from: v.pipe(v.number('must be a number'), v.finite('must be a finite number')),
	color: v.pipe(v.string('must be text'), v.trim(), v.minLength(1, 'must not be empty'))
});

function finiteOrUndefined(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function bySegmentStart<T extends GaugeSegment>(segments: T[]): T[] {
	// a stable sort, so of two segments with one start the later listed wins
	return segments
		.filter((segment) => Number.isFinite(segment.from))
		.sort((a, b) => a.from - b.from);
}

function normalizeSegments(raw: unknown): GaugeSegment[] | undefined {
	if (!Array.isArray(raw)) return undefined;
	const segments = raw.flatMap((entry): GaugeSegment[] => {
		if (!isRecord(entry)) return [];
		const from = finiteOrUndefined(entry.from);
		const color = trimmedOrUndefined(entry.color);
		return from !== undefined && color ? [{ from, color }] : [];
	});
	return segments.length ? bySegmentStart(segments) : undefined;
}

/** Where `value` sits between `min` and `max`, clamped to 0..1; 0 when there is no usable range. */
export function gaugeFraction(value: number | null, min: number, max: number): number {
	if (value === null || ![value, min, max].every(Number.isFinite) || min >= max) return 0;
	if (value <= min) return 0;
	if (value >= max) return 1;
	// halved, so a range wider than the largest number does not overflow
	return (value / 2 - min / 2) / (max / 2 - min / 2);
}

/** The last segment whose start is at or below `value`, in any listed order. */
export function gaugeSegment<T extends GaugeSegment>(
	segments: T[] | undefined,
	value: number | null
): T | undefined {
	if (!segments || value === null || !Number.isFinite(value)) return undefined;
	let match: T | undefined;
	for (const segment of bySegmentStart(segments)) if (segment.from <= value) match = segment;
	return match;
}

/**
 * The stretch of the range each segment covers, as 0..1 fractions of it: from
 * its own start to the next one's, the last to the end. Segments clamped to
 * nothing are left out.
 */
export function gaugeBands<T extends GaugeSegment>(
	segments: T[] | undefined,
	min: number,
	max: number
): { start: number; end: number; segment: T }[] {
	if (!segments || min >= max) return [];
	const sorted = bySegmentStart(segments);
	return sorted
		.map((segment, index) => ({
			start: gaugeFraction(segment.from, min, max),
			end: index + 1 < sorted.length ? gaugeFraction(sorted[index + 1].from, min, max) : 1,
			segment
		}))
		.filter((band) => band.end > band.start);
}

export const gaugeCard: CardDefinition<GaugeCard> = {
	type: 'gauge',
	label: 'hearth_card_gauge_label',
	name: 'hearth_card_gauge_name',
	sub: 'hearth_card_gauge_sub',
	icon: 'speed',
	group: 'information',
	// a half arc stretched tall reads as an empty card
	fillByDefault: false,
	normalize: (card) => {
		const min = finiteOrUndefined(card.min);
		const max = finiteOrUndefined(card.max);
		// a reversed or empty range falls back to the defaults as a pair
		const ordered = (min ?? GAUGE_MIN) < (max ?? GAUGE_MAX);
		return {
			entity: trimmedOrUndefined(card.entity),
			name: trimmedOrUndefined(card.name),
			unit: trimmedOrUndefined(card.unit),
			min: ordered ? min : undefined,
			max: ordered ? max : undefined,
			segments: normalizeSegments(card.segments),
			needle: card.needle === true ? true : undefined
		};
	},
	schema: v.pipe(
		v.looseObject({
			entity: OptionalEntityId,
			name: OptionalText,
			unit: OptionalText,
			min: OptionalNumber,
			max: OptionalNumber,
			segments: v.optional(v.array(GaugeSegmentSchema, 'must be a list of { from, color }')),
			needle: OptionalFlag
		}),
		v.check((card) => (card.min ?? GAUGE_MIN) < (card.max ?? GAUGE_MAX), 'min must be below max')
	),
	draft: ({ entityIds }) => {
		const sensors = inDomains(entityIds, ['sensor']);
		// entity ids carry no unit; these names usually read in percent
		const entity = sensors.find((entityId) => /humidity|battery/.test(entityId)) ?? sensors[0];
		return entity ? { entity } : undefined;
	},
	needsConfiguration: (card) => !card.entity,
	entityIds: (card) => (card.entity ? [card.entity] : [])
};
