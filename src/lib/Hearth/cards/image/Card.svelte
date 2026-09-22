<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import { states } from '$lib/core/ha/entities';
	import type { OverviewCard } from '../../config';
	import EmptyState from '../../EmptyState.svelte';

	let { card }: { card: Extract<OverviewCard, { type: 'image' }> } = $props();

	let entity = $derived(card.entity ? $states?.[card.entity] : undefined);
	let entityPicture = $derived(entity?.attributes?.entity_picture as string | undefined);
	let imageSource = $derived.by(() => {
		if (!entityPicture) return undefined;
		const revision = entity?.state ?? entity?.last_updated;
		if (!revision) return entityPicture;
		const separator = entityPicture.includes('?') ? '&' : '?';
		return `${entityPicture}${separator}hearth=${encodeURIComponent(revision)}`;
	});
	// the source that failed to load rather than a flag, so a new revision is
	// retried without an effect to reset it
	let failedSource = $state<string | undefined>(undefined);
</script>

<div class="section">
	{#if card.title}
		<div class="section-title">{card.title}</div>
	{/if}

	{#if !card.entity}
		<EmptyState text={$lang('hearth_pick_an_image_entity_in_the')} />
	{:else if entity?.state === 'unavailable'}
		<EmptyState text={$lang('hearth_image_unavailable')} />
	{:else if imageSource && imageSource !== failedSource}
		<div class="image-frame">
			<img
				src={imageSource}
				alt={card.title ?? entity?.attributes?.friendly_name ?? card.entity}
				onerror={() => (failedSource = imageSource)}
			/>
		</div>
	{:else}
		<EmptyState text={$lang('hearth_image_unavailable')} />
	{/if}
</div>

<style>
	.section-title {
		font-size: var(--h-type-title);
		font-weight: 600;
		color: var(--h-text-2);
		margin-bottom: 14px;
	}

	.image-frame {
		display: grid;
		place-items: center;
		min-height: 120px;
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.06 * var(--h-line-scale)));
		border-radius: var(--h-radius-card);
		background: var(--h-inset);
		backdrop-filter: var(--h-surface-blur);
		box-shadow: var(--h-card-shadow);
		overflow: hidden;
	}

	img {
		display: block;
		width: 100%;
		height: auto;
		max-height: 60dvh;
		object-fit: contain;
	}
</style>
