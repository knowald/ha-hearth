import type { WidgetDescriptor } from '../types';
import Widget from './Widget.svelte';
import { energyWidget as definition, type EnergyWidget } from '../../model/widgets/energy';
export type { EnergyWidget } from '../../model/widgets/energy';

export const energyWidget: WidgetDescriptor<EnergyWidget> = {
	...definition,
	component: Widget,
	editor: () => import('./Editor.svelte')
};
