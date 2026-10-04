import * as v from 'valibot';
import type { OverviewCard } from '../../types';
import { normalizeTemplate, trimmedOrUndefined } from '../../normalizers';
import type { CardDefinition } from '../types';
import { OptionalEntityIdList, OptionalText } from '../../schema';

export type TemplateCard = Extract<OverviewCard, { type: 'template' }>;

export const templateCard: CardDefinition<TemplateCard> = {
	type: 'template',
	label: 'hearth_card_template_label',
	name: 'hearth_card_template_name',
	sub: 'hearth_card_template_sub',
	icon: 'code',
	normalize: (card) => {
		const entities = (Array.isArray(card.entities) ? card.entities : [])
			.map(trimmedOrUndefined)
			.filter((entity): entity is string => Boolean(entity));
		return {
			content: normalizeTemplate(card.content),
			title: trimmedOrUndefined(card.title),
			icon: trimmedOrUndefined(card.icon),
			entities: entities.length ? entities : undefined
		};
	},
	schema: v.looseObject({
		content: OptionalText,
		title: OptionalText,
		icon: OptionalText,
		entities: OptionalEntityIdList
	}),
	needsConfiguration: (card) => !card.content,
	entityIds: (card) => card.entities ?? []
};
