import * as v from 'valibot';
import type { OverviewCard } from '../../types';
import { trimmedOrUndefined } from '../../normalizers';
import type { CardDefinition } from '../types';
import { OptionalText, OptionalEntityId } from '../../schema';

export type ClimateCard = Extract<OverviewCard, { type: 'climate' }>;

export const climateCard: CardDefinition<ClimateCard> = {
	type: 'climate',
	label: 'hearth_card_climate_label',
	name: 'hearth_card_climate_name',
	sub: 'hearth_card_climate_sub',
	icon: 'thermostat',
	normalize: (card) => ({
		entity: trimmedOrUndefined(card.entity),
		title: trimmedOrUndefined(card.title)
	}),
	schema: v.looseObject({ entity: OptionalEntityId, title: OptionalText }),
	needsConfiguration: (card) => !card.entity,
	entityIds: (card) => (card.entity ? [card.entity] : [])
};
