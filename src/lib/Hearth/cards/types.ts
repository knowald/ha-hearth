import type { Component } from 'svelte';
import type { CardDefinition } from '../model/types';
import type { EntityRef, OverviewCard } from '../types';

/** The fields a card editor owns: everything but the id, type and the layout options the shell adds. */
export type CardFields<T extends OverviewCard> = Omit<
	T,
	'id' | 'type' | 'fill' | 'height' | 'visibility'
>;

export interface CardDraft<T extends OverviewCard> {
	fields: CardFields<T>;
	/** false blocks Done, for example while advanced YAML does not parse */
	valid?: boolean;
}

export interface CardEditorProps<T extends OverviewCard> {
	/** The card being edited when it is of this type; undefined for a new card or after a type switch. */
	initial: T | undefined;
	/** Called with the current draft whenever a field changes, including once on mount. */
	onchange: (draft: CardDraft<T>) => void;
}

export interface CardComponentProps<T extends OverviewCard> {
	card: T;
	/** Draft-card callback used by the card editor's interactive preview. */
	onentitiesreorder?: (entities: EntityRef[]) => void;
	showEntityDragHandles?: boolean;
}

/**
 * Everything the dashboard needs to know about one card type. Adding a type
 * means adding a folder with these three parts and one line in cards/index.ts.
 */
export interface CardDescriptor<T extends OverviewCard = OverviewCard> extends CardDefinition<T> {
	component: Component<CardComponentProps<T>>;
	/** Loaded when the edit sheet opens, so editors stay out of the dashboard bundle. */
	editor: () => Promise<{ default: CardEditor<T> }>;
}

export type CardEditor<T extends OverviewCard = OverviewCard> = Component<
	CardEditorProps<T>,
	{ applyPreviewReorder?: (entities: EntityRef[]) => void }
>;
