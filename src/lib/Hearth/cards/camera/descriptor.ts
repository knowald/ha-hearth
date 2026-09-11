import type { CardDescriptor } from '../types';
import Card from './Card.svelte';
import { cameraCard as definition, type CameraCard } from '../../model/cards/camera';
export type { CameraCard } from '../../model/cards/camera';

export const cameraCard: CardDescriptor<CameraCard> = {
	...definition,
	component: Card,
	editor: () => import('./Editor.svelte')
};
