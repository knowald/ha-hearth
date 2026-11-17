import * as v from 'valibot';
import type { OverviewCard } from '../../types';
import { isRecord, trimmedOrUndefined } from '../../normalizers';
import type { CardDefinition } from '../types';
import { inDomains } from './draft';
import { EntityIdSchema, OptionalText } from '../../schema';

export type ChartCard = Extract<OverviewCard, { type: 'chart' }>;
export type ChartEntity = NonNullable<ChartCard['entities']>[number];

export const CHART_STYLES = ['line', 'bar'] as const;
export const CHART_PERIODS = ['day', 'week', 'month'] as const;
/** More series than this no longer read apart on a card-sized plot. */
export const CHART_MAX_ENTITIES = 6;

const ChartEntitySchema = v.object({
	entity: EntityIdSchema,
	name: OptionalText,
	color: OptionalText
});

function normalizeEntities(raw: unknown): ChartEntity[] | undefined {
	if (!Array.isArray(raw)) return undefined;
	const entities = raw.flatMap((entry): ChartEntity[] => {
		if (!isRecord(entry)) return [];
		const entity = trimmedOrUndefined(entry.entity);
		if (!entity) return [];
		return [
			{
				entity,
				name: trimmedOrUndefined(entry.name),
				color: trimmedOrUndefined(entry.color)
			}
		];
	});
	return entities.length ? entities.slice(0, CHART_MAX_ENTITIES) : undefined;
}

export const chartCard: CardDefinition<ChartCard> = {
	type: 'chart',
	label: 'hearth_card_chart_label',
	name: 'hearth_card_chart_name',
	sub: 'hearth_card_chart_sub',
	icon: 'show_chart',
	group: 'information',
	fillByDefault: true,
	sizable: true,
	stretchMinHeight: 240,
	normalize: (card) => ({
		name: trimmedOrUndefined(card.name),
		style: CHART_STYLES.includes(card.style) ? card.style : undefined,
		period: CHART_PERIODS.includes(card.period) ? card.period : undefined,
		entities: normalizeEntities(card.entities)
	}),
	schema: v.looseObject({
		name: OptionalText,
		style: v.optional(v.picklist(CHART_STYLES, 'must be line or bar')),
		period: v.optional(v.picklist(CHART_PERIODS, 'must be day, week or month')),
		entities: v.optional(
			v.pipe(
				v.array(ChartEntitySchema, 'must be a list of { entity, name, color }'),
				v.maxLength(CHART_MAX_ENTITIES, `must list at most ${CHART_MAX_ENTITIES} entities`)
			)
		)
	}),
	// entity ids carry no unit; a temperature sensor is the likely first chart
	draft: ({ entityIds }) => {
		const sensors = inDomains(entityIds, ['sensor']);
		const entity = sensors.find((entityId) => entityId.includes('temperature')) ?? sensors[0];
		return entity ? { entities: [{ entity }] } : undefined;
	},
	needsConfiguration: (card) => !card.entities?.length,
	entityIds: (card) => (card.entities ?? []).map((entry) => entry.entity)
};
