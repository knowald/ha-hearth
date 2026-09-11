<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import CameraPlayer from '../../CameraPlayer.svelte';
	import type { OverviewCard } from '../../config';

	let { card }: { card: Extract<OverviewCard, { type: 'camera' }> } = $props();
</script>

<div class="section">
	{#if card.title}
		<div class="section-title">{card.title}</div>
	{/if}
	{#if card.entity}
		<div class="camera">
			<CameraPlayer entity={card.entity} stream={card.stream} />
		</div>
	{:else}
		<div class="placeholder">{$lang('hearth_pick_a_camera_entity_in_the')}</div>
	{/if}
</div>

<style>
	.section-title {
		font-size: var(--h-type-title);
		font-weight: 600;
		color: var(--h-text-2);
		margin-bottom: 14px;
	}

	.camera {
		border-radius: var(--h-radius-md);
		overflow: hidden;
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.06 * var(--h-line-scale)));
	}

	.placeholder {
		padding: 22px;
		border-radius: var(--h-radius-md);
		border: 1px dashed rgb(var(--h-line-rgb) / calc(0.15 * var(--h-line-scale)));
		color: var(--h-text-6);
		font-size: var(--h-type-body);
		text-align: center;
	}
</style>
