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

/** The heading a card type sits under in the add-card gallery. */
export type CardGroup = 'devices' | 'information' | 'media';

/** What a card type's draft is built from when the add-card gallery previews it. */
export interface CardDraftContext {
	/** Candidate entity ids, the page's own first. */
	entityIds: string[];
	pageName: string;
}

export interface CardDefinition<T extends OverviewCard = OverviewCard> extends Definition<T> {
	group: CardGroup;
	/**
	 * A first configuration for the add-card preview, picked from what Home
	 * Assistant has. Undefined when nothing fits; the preview then shows what
	 * the card still needs.
	 */
	draft?: (context: CardDraftContext) => Partial<T> | undefined;
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
