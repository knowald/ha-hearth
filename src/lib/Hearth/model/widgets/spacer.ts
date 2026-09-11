import * as v from 'valibot';
import type { RailWidget } from '../../types';
import { normalizeWholeNumber } from '../../normalizers';
import { OptionalFlag, optionalNumberAtLeast } from '../../schema';
import type { WidgetDefinition } from '../types';

export type SpacerWidget = Extract<RailWidget, { type: 'spacer' }>;

/** Smallest fixed gap in px; below that the widget is only a line. */
export const SPACER_MIN_HEIGHT = 4;

export const spacerWidget: WidgetDefinition<SpacerWidget> = {
	type: 'spacer',
	label: 'hearth_widget_spacer_label',
	name: 'hearth_widget_spacer_name',
	sub: 'hearth_widget_spacer_sub',
	icon: 'unfold_more',
	normalize: (widget) => ({
		line: widget.line === true ? true : undefined,
		height: normalizeWholeNumber(widget.height, SPACER_MIN_HEIGHT)
	}),
	schema: v.looseObject({ line: OptionalFlag, height: optionalNumberAtLeast(SPACER_MIN_HEIGHT) }),
	entityIds: () => []
};
