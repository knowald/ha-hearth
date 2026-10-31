import * as v from 'valibot';
import { OptionalText, SceneRefSchema } from '../../schema';
import type { OverviewCard, SceneRef } from '../../types';
import { normalizeSceneRef } from '../../normalizers';
import type { CardDefinition } from '../types';
import { inDomains } from './draft';

export type ScenesCard = Extract<OverviewCard, { type: 'scenes' }>;

export const scenesCard: CardDefinition<ScenesCard> = {
	type: 'scenes',
	label: 'hearth_card_scenes_label',
	name: 'hearth_card_scenes_name',
	sub: 'hearth_card_scenes_sub',
	icon: 'palette',
	group: 'devices',
	normalize: (card) => ({
		style: card.style === 'bar' ? 'bar' : undefined,
		scenes: (Array.isArray(card.scenes) ? card.scenes : [])
			.map(normalizeSceneRef)
			.filter((ref: SceneRef | null): ref is SceneRef => ref !== null)
	}),
	schema: v.looseObject({
		title: OptionalText,
		style: v.optional(v.picklist(['chips', 'bar'], 'must be chips or bar')),
		scenes: v.optional(v.array(SceneRefSchema, 'must be a list'))
	}),
	draft: ({ entityIds }) => {
		const scenes = inDomains(entityIds, ['scene'], 6);
		return scenes.length ? { scenes: scenes.map((entity) => ({ entity })) } : undefined;
	},
	needsConfiguration: (card) => card.scenes.length === 0,
	entityIds: (card) =>
		card.scenes.flatMap((ref) => [ref.entity, ...(ref.active_entity ? [ref.active_entity] : [])])
};
