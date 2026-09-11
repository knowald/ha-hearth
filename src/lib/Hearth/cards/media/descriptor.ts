import type { CardDescriptor } from '../types';
import Card from './Card.svelte';
import { mediaCard as definition, type MediaCard } from '../../model/cards/media';
export type { MediaCard } from '../../model/cards/media';

export const mediaCard: CardDescriptor<MediaCard> = {
	...definition,
	component: Card,
	editor: () => import('./Editor.svelte')
};
