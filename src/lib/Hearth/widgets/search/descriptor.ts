import type { WidgetDescriptor } from '../types';
import Widget from './Widget.svelte';
import { searchWidget as definition, type SearchWidget } from '../../model/widgets/search';
export type { SearchWidget } from '../../model/widgets/search';

export const searchWidget: WidgetDescriptor<SearchWidget> = {
	...definition,
	component: Widget
};
