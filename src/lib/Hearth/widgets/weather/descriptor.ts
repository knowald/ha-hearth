import type { WidgetDescriptor } from '../types';
import Widget from './Widget.svelte';
import { weatherWidget as definition, type WeatherWidget } from '../../model/widgets/weather';
export type { WeatherWidget } from '../../model/widgets/weather';

export const weatherWidget: WidgetDescriptor<WeatherWidget> = {
	...definition,
	component: Widget,
	editor: () => import('./Editor.svelte')
};
