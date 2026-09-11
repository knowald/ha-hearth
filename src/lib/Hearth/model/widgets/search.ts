import * as v from 'valibot';
import type { RailWidget } from '../../types';
import type { WidgetDefinition } from '../types';

export type SearchWidget = Extract<RailWidget, { type: 'search' }>;

export const searchWidget: WidgetDefinition<SearchWidget> = {
	type: 'search',
	label: 'hearth_widget_search_label',
	name: 'hearth_widget_search_name',
	sub: 'hearth_widget_search_sub',
	icon: 'search',
	normalize: () => ({}),
	schema: v.looseObject({}),
	entityIds: () => []
};
