import type { CardDescriptor } from '../types';
import Card from './Card.svelte';
import { daysSinceCard as definition, type DaysSinceCard } from '../../model/cards/days_since';
export type { DaysSinceCard } from '../../model/cards/days_since';

export const daysSinceCard: CardDescriptor<DaysSinceCard> = {
	...definition,
	component: Card,
	editor: () => import('./Editor.svelte')
};
