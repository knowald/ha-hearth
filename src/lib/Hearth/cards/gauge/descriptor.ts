import type { CardDescriptor } from '../types';
import Card from './Card.svelte';
import { gaugeCard as definition, type GaugeCard } from '../../model/cards/gauge';
export type { GaugeCard } from '../../model/cards/gauge';

export const gaugeCard: CardDescriptor<GaugeCard> = {
	...definition,
	component: Card,
	editor: () => import('./Editor.svelte')
};
