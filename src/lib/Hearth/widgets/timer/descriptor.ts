import type { WidgetDescriptor } from '../types';
import Widget from './Widget.svelte';
import { timerWidget as definition, type TimerWidget } from '../../model/widgets/timer';
export type { TimerWidget } from '../../model/widgets/timer';

export const timerWidget: WidgetDescriptor<TimerWidget> = {
	...definition,
	component: Widget,
	editor: () => import('./Editor.svelte')
};
