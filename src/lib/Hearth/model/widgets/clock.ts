import * as v from 'valibot';
import type { RailWidget } from '../../types';
import type { WidgetDefinition } from '../types';
import { OptionalText, OptionalFlag } from '../../schema';
import { validTimeZone } from '../../clock';

export type ClockWidget = Extract<RailWidget, { type: 'clock' }>;

export const clockWidget: WidgetDefinition<ClockWidget> = {
	type: 'clock',
	label: 'hearth_widget_clock_label',
	name: 'hearth_widget_clock_name',
	sub: 'hearth_widget_clock_sub',
	icon: 'schedule',
	normalize: (widget) => ({
		timezone: validTimeZone(widget.timezone),
		hour_format: ['auto', '12', '24'].includes(widget.hour_format) ? widget.hour_format : undefined,
		show_seconds: widget.show_seconds === true ? true : undefined
	}),
	schema: v.looseObject({
		timezone: OptionalText,
		hour_format: v.optional(v.picklist(['auto', '12', '24'], 'must be auto, 12 or 24')),
		show_seconds: OptionalFlag
	}),
	entityIds: () => []
};
