import type { CardDescriptor } from '../types';
import Card from './Card.svelte';
import { todoCard as definition, type TodoCard } from '../../model/cards/todo';
export type { TodoCard } from '../../model/cards/todo';

export const todoCard: CardDescriptor<TodoCard> = {
	...definition,
	component: Card,
	editor: () => import('./Editor.svelte')
};
