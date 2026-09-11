import type { CardDescriptor } from '../types';
import Card from './Card.svelte';
import { climateCard as definition, type ClimateCard } from '../../model/cards/climate';
export type { ClimateCard } from '../../model/cards/climate';

export const climateCard: CardDescriptor<ClimateCard> = {
	...definition,
	component: Card,
	editor: () => import('./Editor.svelte')
};
