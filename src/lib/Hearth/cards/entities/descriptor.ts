import type { CardDescriptor } from '../types';
import Card from './Card.svelte';
import { entitiesCard as definition, type EntitiesCard } from '../../model/cards/entities';
export type { EntitiesCard } from '../../model/cards/entities';

export const entitiesCard: CardDescriptor<EntitiesCard> = {
	...definition,
	component: Card,
	editor: () => import('./Editor.svelte')
};
