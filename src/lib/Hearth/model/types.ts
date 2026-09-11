import type { GenericSchema } from 'valibot';
import type { OverviewCard, RailWidget } from '../types';

/** Serializable configuration behavior, independent of rendering and editor components. */
interface Definition<T extends { type: string }> {
	type: T['type'];
	label: string;
	name: string;
	sub: string;
	icon: string;
	normalize: (raw: Record<string, any>) => Partial<T>;
	schema: GenericSchema;
	entityIds: (value: T) => string[];
}

export interface CardDefinition<T extends OverviewCard = OverviewCard> extends Definition<T> {
	fillByDefault?: boolean;
	sizable?: boolean;
	previewReorder?: boolean;
	previewInteractive?: boolean;
	stretchMinHeight?: number;
	heightHint?: string;
	needsConfiguration: (card: T) => boolean;
}

export interface WidgetDefinition<T extends RailWidget = RailWidget> extends Definition<T> {
	needsConfiguration?: (widget: T) => boolean;
}
