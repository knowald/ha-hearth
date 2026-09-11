import type { CardDescriptor } from '../types';
import Card from './Card.svelte';
import { imageCard as definition, type ImageCard } from '../../model/cards/image';
export type { ImageCard } from '../../model/cards/image';

export const imageCard: CardDescriptor<ImageCard> = {
	...definition,
	component: Card,
	editor: () => import('./Editor.svelte')
};
