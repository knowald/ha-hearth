import type { CardDescriptor } from '../types';
import Card from './Card.svelte';
import { chartCard as definition, type ChartCard } from '../../model/cards/chart';
export type { ChartCard } from '../../model/cards/chart';

export const chartCard: CardDescriptor<ChartCard> = {
	...definition,
	component: Card,
	editor: () => import('./Editor.svelte')
};
