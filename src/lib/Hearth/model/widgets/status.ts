import * as v from 'valibot';
import type { RailWidget } from '../../types';
import type { WidgetDefinition } from '../types';
import { ActionSchema, OptionalText, OptionalEntityId } from '../../schema';
import { normalizeAction, trimmedOrUndefined } from '../../normalizers';

export type StatusWidget = Extract<RailWidget, { type: 'status' }>;

export const statusWidget: WidgetDefinition<StatusWidget> = {
	type: 'status',
	label: 'hearth_widget_status_label',
	name: 'hearth_widget_status_name',
	sub: 'hearth_widget_status_sub',
	icon: 'eco',
	normalize: (widget) => ({
		icon: trimmedOrUndefined(widget.icon),
		text: trimmedOrUndefined(widget.text),
		entity: trimmedOrUndefined(widget.entity),
		tap_action: normalizeAction(widget.tap_action),
		hold_action: normalizeAction(widget.hold_action)
	}),
	schema: v.looseObject({
		icon: OptionalText,
		text: OptionalText,
		entity: OptionalEntityId,
		tap_action: v.optional(ActionSchema),
		hold_action: v.optional(ActionSchema)
	}),
	entityIds: (widget) => (widget.entity ? [widget.entity] : [])
};
