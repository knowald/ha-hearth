import type { CardDescriptor } from '../types';
import Card from './Card.svelte';
import { vacuumCard as definition, type VacuumCard } from '../../model/cards/vacuum';
export type { VacuumCard } from '../../model/cards/vacuum';

export const vacuumCard: CardDescriptor<VacuumCard> = {
	...definition,
	component: Card,
	editor: () => import('./Editor.svelte')
};
