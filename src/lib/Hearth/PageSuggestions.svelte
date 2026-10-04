<script lang="ts">
	import { get } from 'svelte/store';
	import { connection } from '$lib/core/ha/connection';
	import { states } from '$lib/core/ha/entities';
	import { fetchRegistry, type RegistrySnapshot } from '$lib/core/ha/registry';
	import { fill, lang } from '$lib/core/i18n';
	import Ripple from '$lib/ui/actions/ripple';
	import { PRESS_RIPPLE } from './config';
	import { ICON } from './iconSizes';
	import Icon from './Icon.svelte';
	import { applying, applyNow } from './applyNow';
	import { roomEntityIds } from './importPlan';
	import { cardDefinition } from './model/registry';
	import { addSuggestedCard, suggestCards, type CardSuggestion } from './pageSuggestions';
	import { hearthConfig, hearthEditMode } from './store';

	/*
	 * Cards the import would give the area a page is named after, offered on
	 * that page while it is empty; one tap adds one card. Outside edit mode
	 * the card is saved at once (see applyNow).
	 */

	let { roomId }: { roomId: string } = $props();

	let registry = $state.raw<RegistrySnapshot | null>(null);

	$effect(() => {
		if (!$connection || registry) return;
		let current = true;
		fetchRegistry().then(
			(snapshot) => {
				if (current) registry = snapshot;
			},
			(error) => console.warn('page suggestions unavailable', error)
		);
		return () => {
			current = false;
		};
	});

	// ?menu=false hides the way into edit mode, so the page offers no way around it
	const kiosk = new URLSearchParams(location.search).get('menu') === 'false';

	let room = $derived($hearthConfig.rooms.find((entry) => entry.id === roomId));

	// built once per registry load, page name and arrival of the states, not
	// on every state change
	let roomName = $derived(room?.name);
	let statesLoaded = $derived($states !== undefined);
	let offered = $derived(
		registry && roomName !== undefined && statesLoaded
			? suggestCards({ name: roomName }, registry, get(states) ?? {})
			: []
	);

	// a suggestion whose entities the page already shows has been taken
	let suggestions = $derived.by(() => {
		if (!room) return [];
		const shown = roomEntityIds(room, statesLoaded ? Object.keys(get(states)) : []);
		return offered.filter((suggestion) =>
			(cardDefinition(suggestion.card.type)?.entityIds(suggestion.card as never) ?? []).some(
				(entity) => !shown.has(entity)
			)
		);
	});

	function label(suggestion: CardSuggestion) {
		const card = suggestion.card;
		if ('title' in card && card.title) return card.title;
		const entity = 'entity' in card ? card.entity : undefined;
		const name = entity ? $states?.[entity]?.attributes?.friendly_name : undefined;
		return name ? String(name) : $lang(cardDefinition(card.type)?.name ?? card.type);
	}

	function add(suggestion: CardSuggestion) {
		void applyNow((config) => addSuggestedCard(config, roomId, suggestion));
	}
</script>

{#if suggestions.length && room && ($hearthEditMode || !kiosk)}
	<section class="suggestions" aria-label={$lang('hearth_suggested_cards')}>
		<div class="title">{fill($lang('hearth_suggested_for'), { name: room.name })}</div>
		<div class="chips">
			{#each suggestions as suggestion (suggestion.card.id)}
				<button
					type="button"
					class="chip pressable"
					use:Ripple={PRESS_RIPPLE}
					aria-label={fill($lang('hearth_add_named'), { name: label(suggestion) })}
					disabled={$applying}
					onclick={() => add(suggestion)}
				>
					<Icon name={cardDefinition(suggestion.card.type)?.icon ?? 'add'} size={ICON.inline} />
					<span>{label(suggestion)}</span>
					<Icon name="add" size={ICON.inline} />
				</button>
			{/each}
		</div>
	</section>
{/if}

<style>
	.suggestions {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-bottom: 24px;
		padding: 16px;
		border-radius: var(--h-radius-md);
		border: 1px dashed rgb(var(--h-line-rgb) / calc(0.15 * var(--h-line-scale)));
	}

	.title {
		font-size: var(--h-type-secondary);
		color: var(--h-text-4);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.chip {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 40px;
		padding: 0 14px;
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.1 * var(--h-line-scale)));
		border-radius: var(--h-radius-pill);
		background: rgb(var(--h-surface-rgb) / calc(0.05 * var(--h-fill-scale)));
		color: var(--h-text-2);
		font: inherit;
		font-size: var(--h-type-secondary);
		cursor: pointer;
	}

	/* the card before it is still being saved */
	.chip:disabled {
		opacity: 0.5;
		cursor: progress;
	}
</style>
