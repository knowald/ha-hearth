<script lang="ts">
	import { ICON } from '../../iconSizes';
	import { lang } from '$lib/core/i18n';
	import { watchMarkdownTemplate, type MarkdownRender } from '../../templateMarkdown';
	import { get } from 'svelte/store';
	import { EDIT_SETTLE_MS } from '../../lazyTemplates';
	import { hearthEditMode } from '../../store';
	import Icon from '../../Icon.svelte';
	import type { TemplateCard } from './descriptor';

	let { card }: { card: TemplateCard } = $props();

	let render = $state<MarkdownRender>({ status: 'loading' });
	// plain, not state: only a change after the first render waits
	let shown = false;

	$effect(() => {
		const template = card.content;
		render = { status: 'loading' };
		if (!template) return;
		const delay = shown && get(hearthEditMode) ? EDIT_SETTLE_MS : 0;
		shown = true;
		return watchMarkdownTemplate(template, (next) => (render = next), delay);
	});
</script>

<div class="section" aria-busy={render.status === 'loading'}>
	{#if card.title || card.icon}
		<div class="section-header">
			{#if card.icon}
				<Icon name={card.icon} size={ICON.control} color="var(--h-accent-icon)" />
			{/if}
			{#if card.title}
				<div class="section-title">{card.title}</div>
			{/if}
		</div>
	{/if}
	<!-- a failing template is the editor's problem: the dashboard shows a quiet
	     placeholder, edit mode says what Home Assistant reported -->
	{#if render.status === 'error' && $hearthEditMode}
		<div class="error">{$lang('hearth_template_error')}: {render.error}</div>
	{:else if render.status === 'ready' && render.html.trim()}
		<div class="markdown">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitized in markdown.ts -->
			{@html render.html}
		</div>
	{:else}
		<div class="placeholder">-</div>
	{/if}
</div>

<style>
	.section-header {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 14px;
	}

	.section-title {
		font-size: var(--h-type-title);
		font-weight: 600;
		color: var(--h-text-2);
	}

	.markdown {
		font-size: var(--h-type-body);
		color: var(--h-text-3);
		overflow-wrap: anywhere;
	}

	.markdown :global(:first-child) {
		margin-top: 0;
	}

	.markdown :global(:last-child) {
		margin-bottom: 0;
	}

	.markdown :global(a) {
		color: var(--h-accent-text);
	}

	.placeholder {
		color: var(--h-text-6);
	}

	.error {
		color: var(--h-bad-text);
		font-size: var(--h-type-small);
		overflow-wrap: anywhere;
	}
</style>
