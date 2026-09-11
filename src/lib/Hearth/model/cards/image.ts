import * as v from 'valibot';
import type { OverviewCard } from '../../types';
import { trimmedOrUndefined } from '../../normalizers';
import type { CardDefinition } from '../types';
import { OptionalText, OptionalEntityId } from '../../schema';

export type ImageCard = Extract<OverviewCard, { type: 'image' }>;

export const imageCard: CardDefinition<ImageCard> = {
	type: 'image',
	label: 'hearth_card_image_label',
	name: 'hearth_card_image_name',
	sub: 'hearth_card_image_sub',
	icon: 'image',
	normalize: (card) => ({
		entity: trimmedOrUndefined(card.entity),
		title: trimmedOrUndefined(card.title)
	}),
	schema: v.looseObject({ entity: OptionalEntityId, title: OptionalText }),
	needsConfiguration: (card) => !card.entity,
	entityIds: (card) => (card.entity ? [card.entity] : [])
};
