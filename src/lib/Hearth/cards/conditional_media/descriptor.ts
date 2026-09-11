import type { CardDescriptor } from '../types';
import Card from './Card.svelte';
import {
	conditionalMediaCard as definition,
	type ConditionalMediaCard
} from '../../model/cards/conditional_media';
export type { ConditionalMediaCard } from '../../model/cards/conditional_media';

export const conditionalMediaCard: CardDescriptor<ConditionalMediaCard> = {
	...definition,
	component: Card,
	editor: () => import('./Editor.svelte')
};
