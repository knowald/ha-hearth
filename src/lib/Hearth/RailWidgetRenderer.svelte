<script lang="ts">
	import { lang, fill } from '$lib/core/i18n';
	import type { RailWidget } from './types';
	import {
		railConfigurationLabel,
		railWidgetNeedsConfiguration,
		widgetDescriptor
	} from './widgets';
	import ConfigurationPlaceholder from './ConfigurationPlaceholder.svelte';
	import { hearthEditMode } from './store';

	let { widget, onsearch = () => {} }: { widget: RailWidget; onsearch?: () => void } = $props();

	let descriptor = $derived(widgetDescriptor(widget.type));

	// while editing, a widget is something to arrange, not to use: only its
	// edit chip reacts. The page list stays live, since it is how pages are
	// switched, reordered and added in edit mode.
	let frozen = $derived($hearthEditMode && widget.type !== 'nav');
</script>

{#if !descriptor}
	<ConfigurationPlaceholder
		text={fill($lang('hearth_unknown_widget_type'), { type: widget.type })}
		context="widget"
	/>
{:else if railWidgetNeedsConfiguration(widget)}
	<ConfigurationPlaceholder
		text={fill($lang('hearth_configure_type'), { type: railConfigurationLabel(widget) })}
		context="widget"
	/>
{:else if descriptor.component}
	<div class="widget-content" class:frozen inert={frozen}>
		<descriptor.component {widget} {onsearch} />
	</div>
{/if}

<style>
	/* a wrapper for inert only; the widget lays out as if it were not there */
	.widget-content {
		display: contents;
	}

	/* inherited, so it also reaches into an embedded page, which inert alone
	   is not guaranteed to */
	.widget-content.frozen {
		pointer-events: none;
	}
</style>
