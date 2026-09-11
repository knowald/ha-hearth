import * as v from 'valibot';
import type { RailWidget } from '../../types';
import type { WidgetDefinition } from '../types';
import { OptionalText, OptionalEntityId } from '../../schema';

export type EntityWidget = Extract<RailWidget, { type: 'entity' }>;

export const entityWidget: WidgetDefinition<EntityWidget> = {
	type: 'entity',
	label: 'hearth_widget_entity_label',
	name: 'hearth_widget_entity_name',
	sub: 'hearth_widget_entity_sub',
	icon: 'monitoring',
	normalize: (widget) => ({
		vertical_padding: widget.vertical_padding === 'compact' ? ('compact' as const) : undefined
	}),
	schema: v.looseObject({
		entity: OptionalEntityId,
		name: OptionalText,
		icon: OptionalText,
		vertical_padding: v.optional(v.picklist(['compact'], 'must be compact'))
	}),
	needsConfiguration: (widget) => !widget.entity,
	entityIds: (widget) => (widget.entity ? [widget.entity] : [])
};
