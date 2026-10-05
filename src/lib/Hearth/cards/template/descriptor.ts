import type { CardDescriptor } from '../types';
import Card from './Card.svelte';
import { templateCard as definition, type TemplateCard } from '../../model/cards/template';
export type { TemplateCard } from '../../model/cards/template';

export const templateCard: CardDescriptor<TemplateCard> = {
	...definition,
	component: Card,
	editor: () => import('./Editor.svelte')
};
