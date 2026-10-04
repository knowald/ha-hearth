<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import { watchMarkdownTemplate, type MarkdownRender } from '../../templateMarkdown';
	import { get } from 'svelte/store';
	import { EDIT_SETTLE_MS } from '../../lazyTemplates';
	import { hearthEditMode } from '../../store';
	import type { TemplateWidget } from './descriptor';

	let { widget }: { widget: TemplateWidget } = $props();

	let render = $state<MarkdownRender>({ status: 'loading' });
	let html = $derived(render.status === 'ready' ? render.html : '');
	let error = $derived(render.status === 'error' ? render.error : null);

	// plain, not state: only a change after the first render waits
	let shown = false;

	// Home Assistant pushes a new render whenever a referenced state changes
	$effect(() => {
		const template = widget.template;
		render = { status: 'loading' };
		if (!template) return;
		const delay = shown && get(hearthEditMode) ? EDIT_SETTLE_MS : 0;
		shown = true;
		return watchMarkdownTemplate(template, (next) => (render = next), delay);
	});
</script>

<!-- a template that renders nothing hides the widget; the editor keeps it findable, dimmed -->
{#if error || html.trim() || $hearthEditMode}
	<div class="template">
		{#if error}
			<div class="error">{$lang('hearth_template_error')}: {error}</div>
		{:else if html.trim()}
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitized in markdown.ts -->
			{@html html}
		{:else}
			<div class="inactive">{$lang('hearth_widget_template_name')}</div>
		{/if}
	</div>
{/if}

<style>
	.template {
		padding: 8px 0;
		font-size: var(--h-type-body);
		color: var(--h-text-3);
		overflow-wrap: anywhere;
	}

	.template :global(p) {
		margin: 0 0 6px;
	}

	.inactive {
		opacity: 0.45;
	}

	.error {
		color: var(--h-bad-text);
		font-size: var(--h-type-small);
	}
</style>
