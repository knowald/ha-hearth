<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import CardRenderer from './CardRenderer.svelte';
	import HeaderCard from './HeaderCard.svelte';
	import type { OverviewCard } from './config';
	import { favorites } from './favorites';

	/*
	 * This browser's starred entities as one grid, in the order they were
	 * starred. It is not a page in hearth.yaml, so it has no editor; a star in
	 * an entity's popup adds or removes a tile.
	 */

	let card = $derived<OverviewCard>({
		id: 'favorites',
		type: 'entities',
		entities: $favorites.entities.map((entity) => ({ entity }))
	});
</script>

<div class="page">
	<div class="header-slot">
		<HeaderCard icon="star" title={$lang('hearth_favorites')} />
	</div>
	<CardRenderer {card} />
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		container: hearth-page / inline-size;
	}

	.header-slot {
		margin-bottom: 32px;
	}
</style>
