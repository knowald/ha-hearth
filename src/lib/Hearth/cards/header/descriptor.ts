import type { CardDescriptor } from '../types';
import Card from './Card.svelte';
import { headerCard as definition, type HeaderCard } from '../../model/cards/header';
export type { HeaderCard } from '../../model/cards/header';

export const headerCard: CardDescriptor<HeaderCard> = {
	...definition,
	component: Card,
	editor: () => import('./Editor.svelte')
};
