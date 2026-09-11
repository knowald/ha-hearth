import * as v from 'valibot';
import type { RailWidget } from '../../types';
import type { WidgetDefinition } from '../types';
import { OptionalText } from '../../schema';

export type TemplateWidget = Extract<RailWidget, { type: 'template' }>;

export const templateWidget: WidgetDefinition<TemplateWidget> = {
	type: 'template',
	label: 'hearth_widget_template_label',
	name: 'hearth_widget_template_name',
	sub: 'hearth_widget_template_sub',
	icon: 'code',
	normalize: (widget) => ({
		template:
			typeof widget.template === 'string' && widget.template.trim() ? widget.template : undefined
	}),
	schema: v.looseObject({ template: OptionalText }),
	needsConfiguration: (widget) => !widget.template,
	entityIds: () => []
};
