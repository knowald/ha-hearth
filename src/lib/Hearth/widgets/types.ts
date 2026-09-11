import type { Component } from 'svelte';
import type { WidgetDefinition } from '../model/types';
import type { RailWidget } from '../types';

/** The fields a widget editor owns: everything but the id, type and the visibility options the shell adds. */
export type WidgetFields<T extends RailWidget> = Omit<
	T,
	'id' | 'type' | 'hide_mobile' | 'visibility'
>;

export interface WidgetDraft<T extends RailWidget> {
	fields: WidgetFields<T>;
	/** false blocks Done, for example for an unknown time zone */
	valid?: boolean;
}

export interface WidgetEditorProps<T extends RailWidget> {
	initial: T | undefined;
	onchange: (draft: WidgetDraft<T>) => void;
}

export interface WidgetComponentProps<T extends RailWidget> {
	widget: T;
	/** Opens the search overlay; only the search widget uses it. */
	onsearch?: () => void;
}

/**
 * Everything the rail needs to know about one widget type. Adding a type means
 * adding a folder with these parts and one line in widgets/index.ts.
 */
export interface WidgetDescriptor<T extends RailWidget = RailWidget> extends WidgetDefinition<T> {
	component: Component<WidgetComponentProps<T>>;
	/** Absent for widgets with no options. */
	editor?: () => Promise<{ default: Component<WidgetEditorProps<T>> }>;
}
