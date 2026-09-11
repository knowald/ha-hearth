import * as v from 'valibot';
import type { RailWidget } from '../../types';
import type { WidgetDefinition } from '../types';

export type NavWidget = Extract<RailWidget, { type: 'nav' }>;

export const navWidget: WidgetDefinition<NavWidget> = {
	type: 'nav',
	label: 'hearth_widget_nav_label',
	name: 'hearth_widget_nav_name',
	sub: 'hearth_widget_nav_sub',
	icon: 'home',
	normalize: () => ({}),
	schema: v.looseObject({}),
	entityIds: () => []
};
