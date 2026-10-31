<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import { motion } from '$lib/core/app/motion';
	import { states } from '$lib/core/ha/entities';
	import { ICON } from '../iconSizes';
	import { currentRoom, goToPage, hearthConfig } from '../store';
	import { searchAvailable } from '../visibility';
	import { navigablePages } from '../pages';
	import { favoritesOpen, favoritesPageOffered } from '../favorites';
	import Icon from '../Icon.svelte';
	import EditToggle from './EditToggle.svelte';

	/**
	 * The folded layout's navigation, floating at the bottom within thumb
	 * reach: the pages, search, and a More menu holding the edit and screen
	 * entries. Edit mode has its own bar there, so the dashboard swaps this
	 * one for the page strip at the top while editing. `noRail` says the
	 * dashboard has no rail at all, and `menu` is off for a kiosk frame that
	 * asked for no menu (?menu=false).
	 */
	let {
		onsearch,
		noRail = false,
		menu = true
	}: { onsearch: () => void; noRail?: boolean; menu?: boolean } = $props();

	// stands in for the rail's search widget, as the page strip does
	let hasSearch = $derived(searchAvailable($hearthConfig.rail, $states, !noRail));

	// a page picked from search or a ?room= link can sit past the bar's edge
	let tabs: Record<string, HTMLButtonElement | undefined> = {};
	$effect(() => {
		tabs[$currentRoom]?.scrollIntoView?.({
			inline: 'nearest',
			block: 'nearest',
			behavior: $motion ? 'smooth' : 'auto'
		});
	});
</script>

<nav class="phone-bar" aria-label={$lang('hearth_pages')}>
	<div class="tabs">
		{#if $favoritesPageOffered}
			<!-- this browser's own list, ahead of the shared pages -->
			<button
				type="button"
				class="tab pressable"
				class:active={$favoritesOpen}
				aria-current={$favoritesOpen ? 'page' : undefined}
				onclick={() => favoritesOpen.set(true)}
			>
				<Icon name="star" size={ICON.inline} />
				<span>{$lang('hearth_favorites')}</span>
			</button>
		{/if}
		{#each $navigablePages as room (room.id)}
			<button
				type="button"
				class="tab pressable"
				class:active={$currentRoom === room.id && !$favoritesOpen}
				aria-current={$currentRoom === room.id && !$favoritesOpen ? 'page' : undefined}
				bind:this={tabs[room.id]}
				onclick={() => goToPage(room.id)}
			>
				<Icon name={room.icon} size={ICON.inline} />
				<span>{room.name}</span>
			</button>
		{/each}
	</div>
	{#if hasSearch}
		<button type="button" class="search pressable" aria-label={$lang('search')} onclick={onsearch}>
			<Icon name="search" size={ICON.control} />
		</button>
	{/if}
	{#if menu}
		<EditToggle menu />
	{/if}
</nav>

<style>
	.phone-bar {
		position: absolute;
		/* the insets clear an installed app's home indicator and a landscape cutout */
		left: calc(12px + var(--h-pad-x) + var(--h-safe-left));
		right: calc(12px + var(--h-pad-x) + var(--h-safe-right));
		bottom: calc(12px + var(--h-pad-y) + var(--h-safe-bottom));
		z-index: var(--h-layer-bar);
		display: flex;
		align-items: center;
		gap: 4px;
		height: 64px;
		padding: 0 6px;
		border-radius: var(--h-radius-pill);
		/* opaque, and no backdrop filter: a filter would become the containing
		   block of the More menu's fixed popover */
		background: linear-gradient(180deg, var(--h-sheet-0), var(--h-sheet-1));
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.12 * var(--h-line-scale)));
		box-shadow: var(--h-shadow-toast);
	}

	/* many pages scroll sideways inside the bar; search and More stay put */
	.tabs {
		display: flex;
		gap: 4px;
		flex: 1;
		min-width: 0;
		overflow-x: auto;
		scrollbar-width: none;
		border-radius: var(--h-radius-pill);
	}

	.tabs::-webkit-scrollbar {
		display: none;
	}

	.tab {
		flex: 1 0 auto;
		min-width: 64px;
		max-width: 112px;
		height: 52px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		padding: 0 8px;
		border: 0;
		border-radius: var(--h-radius-pill);
		background: none;
		color: var(--h-text-3);
		font: inherit;
		font-size: var(--h-type-label);
		cursor: pointer;
	}

	.tab span {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tab.active {
		background: rgb(var(--h-accent-rgb) / calc(0.18 * var(--h-accent-scale)));
		color: var(--h-accent-text);
	}

	.search {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 52px;
		height: 52px;
		border: 0;
		border-radius: var(--h-radius-pill);
		background: none;
		color: var(--h-text-3);
		cursor: pointer;
	}

	/* a phone held sideways has height to spare for nothing: icon and label
	   share a row. See breakpoints.ts. */
	@media (max-height: 500px) and (orientation: landscape) {
		.phone-bar {
			height: 56px;
		}

		.tab {
			flex-direction: row;
			gap: 6px;
			height: 44px;
			padding: 0 12px;
			max-width: 160px;
		}
	}
</style>
