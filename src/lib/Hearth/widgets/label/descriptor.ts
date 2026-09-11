import type { WidgetDescriptor } from '../types';
import Widget from './Widget.svelte';
import { labelWidget as definition, type LabelWidget } from '../../model/widgets/label';
export type { LabelWidget } from '../../model/widgets/label';

export const labelWidget: WidgetDescriptor<LabelWidget> = {
	...definition,
	component: Widget,
	editor: () => import('./Editor.svelte')
};
