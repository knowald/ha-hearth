import type { WidgetDescriptor } from '../types';
import Widget from './Widget.svelte';
import { statusWidget as definition, type StatusWidget } from '../../model/widgets/status';
export type { StatusWidget } from '../../model/widgets/status';

export const statusWidget: WidgetDescriptor<StatusWidget> = {
	...definition,
	component: Widget,
	editor: () => import('./Editor.svelte')
};
