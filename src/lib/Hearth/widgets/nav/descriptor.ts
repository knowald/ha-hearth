import type { WidgetDescriptor } from '../types';
import Widget from './Widget.svelte';
import { navWidget as definition, type NavWidget } from '../../model/widgets/nav';
export type { NavWidget } from '../../model/widgets/nav';

export const navWidget: WidgetDescriptor<NavWidget> = {
	...definition,
	component: Widget
};
