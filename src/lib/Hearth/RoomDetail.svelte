<script lang="ts">
	import { untrack } from 'svelte';
	import {
		editLockOf,
		ensureRoomCardColumns,
		type HearthConfig,
		type OverviewItem
	} from './config';
	import { editor, hearthConfig, hearthEditMode, hearthLoadError } from './store';
	import CardColumns from './CardColumns.svelte';
	import HeaderCard from './HeaderCard.svelte';

	let { roomId, fillScreen = false }: { roomId: string; fillScreen?: boolean } = $props();

	let room = $derived($hearthConfig.rooms.find((entry) => entry.id === roomId));

	// display columns; an unset/empty cards list still renders the page's
	// column count worth of drop targets in edit mode
	let cardColumns = $derived(
		room?.cards?.length
			? room.cards
			: Array.from({ length: room?.columns ?? 1 }, (): OverviewItem[] => [])
	);

	// resolves (and initializes) the page's card columns inside a config draft
	function locateRoomCards(config: HearthConfig): OverviewItem[][] {
		const target = config.rooms.find((entry) => entry.id === roomId);
		return target ? ensureRoomCardColumns(target) : [];
	}

	// suggestions open on a page found empty and stay while cards are added
	// from them, until another page is shown
	let offeredFor = $state<string | null>(null);
	$effect(() => {
		const id = roomId;
		const empty = !!room && !room.cards?.some((column) => column.length);
		untrack(() => {
			if (empty) offeredFor = id;
			else if (offeredFor !== id) offeredFor = null;
		});
	});

	// outside edit mode only where the edit button would open edit mode at a tap
	let suggesting = $derived(
		offeredFor === roomId &&
			!$hearthLoadError &&
			($hearthEditMode || editLockOf($hearthConfig) === 'off')
	);
</script>

{#if room}
	<div class="page" class:fill={fillScreen} data-page={roomId}>
		{#if !room.hide_header || $hearthEditMode}
			<div class="header-slot" class:hidden-header={room.hide_header}>
				<HeaderCard
					icon={room.icon}
					title={room.name}
					subtitle={room.summary}
					tempEntity={room.temp_entity}
					humidityEntity={room.humidity_entity}
					onedit={() => editor.set({ kind: 'room', id: roomId })}
				/>
			</div>
		{/if}

		{#if suggesting}
			{#await import('./PageSuggestions.svelte') then PageSuggestions}
				<PageSuggestions.default {roomId} />
			{:catch}
				<!-- offline or a stale deploy: the page works without suggestions -->
			{/await}
		{/if}

		<CardColumns
			columns={cardColumns}
			locate={locateRoomCards}
			groupName="hearth-cards"
			{roomId}
			fill
			clipToHeight={fillScreen}
		/>
	</div>
{/if}

<style>
	.page {
		display: flex;
		flex-direction: column;
		min-height: 100%;
		/* the card columns collapse on the page's real width, not the viewport:
		   the rail already took its share, so a viewport breakpoint would fold
		   multi-column pages long before they actually run out of room */
		container: hearth-page / inline-size;
	}

	/* fill mode: the page is exactly the screen, so the columns can hand their
	   leftover height to the cards that stretch */
	.page.fill {
		height: 100%;
		min-height: 0;
	}

	.header-slot {
		margin-bottom: 32px;
	}

	/* hidden headers stay visible in edit mode so the page remains editable */
	.header-slot.hidden-header {
		opacity: 0.45;
	}
</style>
