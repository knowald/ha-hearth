import * as v from 'valibot';
import type { OverviewCard } from '../../types';
import { trimmedOrUndefined } from '../../normalizers';
import type { CardDefinition } from '../types';
import { EntityIdSchema, OptionalFlag, OptionalText } from '../../schema';

export type TodoCard = Extract<OverviewCard, { type: 'todo' }>;

const TODO_ENTITY = /^todo\..+/;

export const todoCard: CardDefinition<TodoCard> = {
	type: 'todo',
	label: 'hearth_card_todo_label',
	name: 'hearth_card_todo_name',
	sub: 'hearth_card_todo_sub',
	icon: 'checklist',
	normalize: (card) => {
		const entity = trimmedOrUndefined(card.entity);
		return {
			entity: entity && TODO_ENTITY.test(entity) ? entity : undefined,
			title: trimmedOrUndefined(card.title),
			show_completed: card.show_completed === true ? true : undefined,
			sort: card.sort === 'alphabetical' || card.sort === 'due' ? card.sort : undefined,
			hide_add: card.hide_add === true ? true : undefined
		};
	},
	schema: v.looseObject({
		entity: v.optional(v.pipe(EntityIdSchema, v.regex(TODO_ENTITY, 'must be a todo entity'))),
		title: OptionalText,
		show_completed: OptionalFlag,
		sort: v.optional(
			v.picklist(['manual', 'alphabetical', 'due'], 'must be manual, alphabetical or due')
		),
		hide_add: OptionalFlag
	}),
	needsConfiguration: (card) => !card.entity,
	entityIds: (card) => (card.entity ? [card.entity] : [])
};
