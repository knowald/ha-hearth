<script lang="ts">
	import type { OverviewCard } from '../types';
	import { provideHearthInteractionMode } from '../interaction';
	import CardRenderer from '../CardRenderer.svelte';

	/** A card that is not on the page yet, drawn the way the page would draw it. */
	let { card }: { card: OverviewCard } = $props();

	provideHearthInteractionMode('preview');
</script>

<div class="draft-preview">
	<CardRenderer {card} showEntityDragHandles={false} />
</div>

<style>
	.draft-preview {
		padding: 14px;
		border-radius: var(--h-radius-md);
		background: var(--h-inset);
	}
</style>
