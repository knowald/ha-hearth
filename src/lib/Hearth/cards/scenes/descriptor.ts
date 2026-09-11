import type { CardDescriptor } from '../types';
import Card from './Card.svelte';
import { scenesCard as definition, type ScenesCard } from '../../model/cards/scenes';
export type { ScenesCard } from '../../model/cards/scenes';

export const scenesCard: CardDescriptor<ScenesCard> = {
	...definition,
	component: Card,
	editor: () => import('./Editor.svelte')
};
