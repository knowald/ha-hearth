import type { WidgetDescriptor } from '../types';
import Widget from './Widget.svelte';
import { spacerWidget as definition, type SpacerWidget } from '../../model/widgets/spacer';
export type { SpacerWidget } from '../../model/widgets/spacer';

export const spacerWidget: WidgetDescriptor<SpacerWidget> = {
	...definition,
	component: Widget,
	editor: () => import('./Editor.svelte')
};
