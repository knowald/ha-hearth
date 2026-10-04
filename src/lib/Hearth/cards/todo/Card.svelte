<script lang="ts">
	import { lang, fill } from '$lib/core/i18n';
	import { states } from '$lib/core/ha/entities';
	import type { TodoCard } from './descriptor';

	let { card }: { card: TodoCard } = $props();

	// the list, its gestures and its Home Assistant feed stay out of the
	// dashboard bundle until a to-do card is on screen
	const list = import('./List.svelte');

	let entity = $derived(card.entity ? $states?.[card.entity] : undefined);
	let title = $derived(card.title || entity?.attributes?.friendly_name || card.entity || '');
	// a list's state is its open item count
	let open = $derived(Number.parseInt(entity?.state ?? '', 10));
</script>

<section class="card" aria-label={title}>
	<div class="header">
		<div class="title">{title}</div>
		{#if Number.isFinite(open) && open > 0}
			<div class="count">{fill($lang('hearth_todo_open_count'), { count: open })}</div>
		{/if}
	</div>
	{#await list then module}
		<module.default {card} />
	{/await}
</section>

<style>
	.card {
		padding: var(--h-card-padding);
		border-radius: var(--h-radius-card);
		background: rgb(var(--h-surface-rgb) / calc(0.05 * var(--h-fill-scale)));
		backdrop-filter: var(--h-surface-blur);
		box-shadow: var(--h-card-shadow);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.07 * var(--h-line-scale)));
	}

	.header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 10px;
	}

	.title {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--h-type-title);
		font-weight: 600;
		color: var(--h-text-2);
	}

	.count {
		flex: none;
		font-size: var(--h-type-secondary);
		color: var(--h-text-5);
	}
</style>
