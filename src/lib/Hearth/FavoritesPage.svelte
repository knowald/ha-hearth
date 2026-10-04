<script lang="ts">
	import { entityAvailability, states } from '$lib/core/ha/entities';
	import { fill, lang } from '$lib/core/i18n';
	import CardRenderer from './CardRenderer.svelte';
	import HeaderCard from './HeaderCard.svelte';
	import Icon from './Icon.svelte';
	import { ICON } from './iconSizes';
	import type { OverviewCard } from './config';
	import { favorites, removeFavorites } from './favorites';

	/*
	 * This browser's starred entities as one grid, in the order they were
	 * starred. It is not a page in hearth.yaml, so instead of an editor it has
	 * a list to remove favorites from, and offers to drop the ones Home
	 * Assistant no longer has.
	 */

	let editing = $state(false);

	let card = $derived<OverviewCard>({
		id: 'favorites',
		type: 'entities',
		entities: $favorites.entities.map((entity) => ({ entity }))
	});

	// only once the states are in can an entity be told apart from one not loaded yet
	let missing = $derived(
		$states === undefined ? [] : $favorites.entities.filter((entity) => !$states[entity])
	);

	function name(entity: string) {
		const friendly = $states?.[entity]?.attributes?.friendly_name;
		return friendly ? String(friendly) : entity;
	}

	function status(entity: string) {
		const availability = entityAvailability($states?.[entity]);
		if (availability === 'missing') return $lang('hearth_missing_entity');
		return availability === 'unavailable' ? $lang('unavailable') : undefined;
	}
</script>

<div class="page">
	<div class="header-slot">
		<HeaderCard icon="star" title={$lang('hearth_favorites')} />
	</div>
	{#if missing.length}
		<div class="notice" role="status">
			<span
				>{fill(
					$lang(
						missing.length === 1 ? 'hearth_favorites_missing_one' : 'hearth_favorites_missing_n'
					),
					{ count: String(missing.length) }
				)}</span
			>
			<button type="button" class="text-button" onclick={() => removeFavorites(missing)}>
				{$lang('hearth_remove_missing')}
			</button>
		</div>
	{/if}
	<CardRenderer {card} />
	<button
		type="button"
		class="text-button manage"
		aria-expanded={editing}
		onclick={() => (editing = !editing)}
	>
		{$lang(editing ? 'done' : 'hearth_edit_favorites')}
	</button>
	{#if editing}
		<ul class="list">
			{#each $favorites.entities as entity (entity)}
				<li class="row">
					<span class="row-text">
						<span class="row-name">{name(entity)}</span>
						{#if status(entity)}<span class="row-status">{status(entity)}</span>{/if}
					</span>
					<button
						type="button"
						class="remove"
						aria-label={fill($lang('hearth_remove_named'), { name: name(entity) })}
						onclick={() => removeFavorites([entity])}
					>
						<Icon name="close" size={ICON.control} />
					</button>
				</li>
			{/each}
		</ul>
	{/if}
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

	.notice {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 18px;
		padding: 10px 14px;
		border-radius: var(--h-radius-sm);
		border: 1px dashed rgb(var(--h-line-rgb) / calc(0.15 * var(--h-line-scale)));
		font-size: var(--h-type-secondary);
		color: var(--h-text-4);
	}

	.text-button {
		flex: none;
		padding: 8px 0;
		border: 0;
		background: none;
		color: var(--h-accent-text);
		font: inherit;
		font-size: var(--h-type-secondary);
		font-weight: 600;
		cursor: pointer;
	}

	.manage {
		align-self: flex-end;
		margin-top: 12px;
	}

	.list {
		margin: 0;
		padding: 0;
		list-style: none;
		border-radius: var(--h-radius-sm);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.08 * var(--h-line-scale)));
	}

	.row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 4px 4px 4px 14px;
	}

	.row + .row {
		border-top: 1px solid rgb(var(--h-line-rgb) / calc(0.08 * var(--h-line-scale)));
	}

	.row-text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.row-name {
		color: var(--h-text-2);
		overflow-wrap: anywhere;
	}

	.remove {
		display: inline-flex;
		flex: none;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		padding: 0;
		border: 0;
		border-radius: var(--h-radius-xs);
		background: none;
		color: var(--h-icon);
		cursor: pointer;
	}

	.row-status {
		font-size: var(--h-type-small);
		color: var(--h-text-5);
	}
</style>
