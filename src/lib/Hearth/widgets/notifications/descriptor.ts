import type { WidgetDescriptor } from '../types';
import Widget from './Widget.svelte';
import {
	notificationsWidget as definition,
	type NotificationsWidget
} from '../../model/widgets/notifications';
export type { NotificationsWidget } from '../../model/widgets/notifications';

export const notificationsWidget: WidgetDescriptor<NotificationsWidget> = {
	...definition,
	component: Widget
};
