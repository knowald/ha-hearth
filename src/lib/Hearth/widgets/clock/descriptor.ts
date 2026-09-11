import type { WidgetDescriptor } from '../types';
import Widget from './Widget.svelte';
import { clockWidget as definition, type ClockWidget } from '../../model/widgets/clock';
export type { ClockWidget } from '../../model/widgets/clock';

export const clockWidget: WidgetDescriptor<ClockWidget> = {
	...definition,
	component: Widget,
	editor: () => import('./Editor.svelte')
};
