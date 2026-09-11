import type { WidgetDescriptor } from '../types';
import Widget from './Widget.svelte';
import { iframeWidget as definition, type IframeWidget } from '../../model/widgets/iframe';
export type { IframeWidget } from '../../model/widgets/iframe';

export const iframeWidget: WidgetDescriptor<IframeWidget> = {
	...definition,
	component: Widget,
	editor: () => import('./Editor.svelte')
};
