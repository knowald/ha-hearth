import * as v from 'valibot';
import type { RailWidget } from '../../types';
import type { WidgetDefinition } from '../types';

export type NotificationsWidget = Extract<RailWidget, { type: 'notifications' }>;

export const notificationsWidget: WidgetDefinition<NotificationsWidget> = {
	type: 'notifications',
	normalize: () => ({}),
	label: 'hearth_widget_notifications_label',
	name: 'hearth_widget_notifications_name',
	sub: 'hearth_widget_notifications_sub',
	icon: 'notifications',
	schema: v.looseObject({}),
	entityIds: () => []
};
