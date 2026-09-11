import type { WidgetDescriptor } from '../types';
import Widget from './Widget.svelte';
import { entityWidget as definition, type EntityWidget } from '../../model/widgets/entity';
export type { EntityWidget } from '../../model/widgets/entity';

export const entityWidget: WidgetDescriptor<EntityWidget> = {
	...definition,
	component: Widget,
	editor: () => import('./Editor.svelte')
};
