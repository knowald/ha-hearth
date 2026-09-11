import type { WidgetDescriptor } from '../types';
import Widget from './Widget.svelte';
import { templateWidget as definition, type TemplateWidget } from '../../model/widgets/template';
export type { TemplateWidget } from '../../model/widgets/template';

export const templateWidget: WidgetDescriptor<TemplateWidget> = {
	...definition,
	component: Widget,
	editor: () => import('./Editor.svelte')
};
