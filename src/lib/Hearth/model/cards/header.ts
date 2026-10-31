import * as v from 'valibot';
import type { OverviewCard } from '../../types';
import { trimmedOrUndefined } from '../../normalizers';
import type { CardDefinition } from '../types';
import { OptionalText, OptionalEntityId, HeaderStatListSchema } from '../../schema';
import { headerStatList, normalizeHeaderStats } from '../headerStats';

export type HeaderCard = Extract<OverviewCard, { type: 'header' }>;

export const headerCard: CardDefinition<HeaderCard> = {
	type: 'header',
	label: 'hearth_card_header_label',
	name: 'hearth_card_header_name',
	sub: 'hearth_card_header_sub',
	icon: 'view_agenda',
	normalize: (card) => ({
		title: trimmedOrUndefined(card.title),
		subtitle: trimmedOrUndefined(card.subtitle),
		icon: trimmedOrUndefined(card.icon),
		temp_entity: trimmedOrUndefined(card.temp_entity),
		humidity_entity: trimmedOrUndefined(card.humidity_entity),
		stats: normalizeHeaderStats(card.stats),
		background_image: trimmedOrUndefined(card.background_image)
	}),
	schema: v.looseObject({
		title: OptionalText,
		subtitle: OptionalText,
		icon: OptionalText,
		temp_entity: OptionalEntityId,
		humidity_entity: OptionalEntityId,
		stats: HeaderStatListSchema,
		background_image: OptionalText
	}),
	needsConfiguration: () => false,
	entityIds: (card) => headerStatList(card).map((stat) => stat.entity)
};
