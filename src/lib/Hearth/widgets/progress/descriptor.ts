import type { WidgetDescriptor } from '../types';
import Widget from './Widget.svelte';
import { progressWidget as definition, type ProgressWidget } from '../../model/widgets/progress';
export type { ProgressWidget } from '../../model/widgets/progress';

export const progressWidget: WidgetDescriptor<ProgressWidget> = {
	...definition,
	component: Widget,
	editor: () => import('./Editor.svelte')
};
