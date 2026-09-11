import type { WidgetDescriptor } from '../types';
import Widget from './Widget.svelte';
import { chartWidget as definition, type ChartWidget } from '../../model/widgets/chart';
export type { ChartWidget } from '../../model/widgets/chart';

export const chartWidget: WidgetDescriptor<ChartWidget> = {
	...definition,
	component: Widget,
	editor: () => import('./Editor.svelte')
};
