import type { CardDescriptor } from '../types';
import Card from './Card.svelte';
import { temperatureCard as definition, type TemperatureCard } from '../../model/cards/temperature';
export type { TemperatureCard } from '../../model/cards/temperature';

export const temperatureCard: CardDescriptor<TemperatureCard> = {
	...definition,
	component: Card,
	editor: () => import('./Editor.svelte')
};
