<script lang="ts">
	import EmptyState from './EmptyState.svelte';
	import { ICON } from './iconSizes';
	import { fill, lang } from '$lib/core/i18n';
	import { states } from '$lib/core/ha/entities';
	import Ripple from '$lib/ui/actions/ripple';
	import { PRESS_RIPPLE } from './config';
	import { domainIcon } from '$lib/core/domains';
	import { goToPage } from './store';
	import { navigablePages } from './pages';
	import { openEntityDetail } from '$lib/Hearth/details';
	import Icon from './Icon.svelte';
	import CloseButton from './CloseButton.svelte';
	import { layer } from '$lib/ui/layers';
	import { runSurfaceAction } from './actions';

	let { onclose }: { onclose: () => void } = $props();

	const MAX_ENTITY_RESULTS = 50;

	let query = $state('');
	let activeIndex = $state(0);
	let rowEls: (HTMLButtonElement | undefined)[] = [];
	// closing on pointerdown would let the click land on the tile underneath,
	// and a drag out of the panel must not count as a backdrop tap
	let pressStartedOnBackdrop = false;

	type Result =
		| { kind: 'room'; id: string; name: string; icon: string }
		| { kind: 'entity'; entityId: string; name: string; state: string };

	// prefix matches outrank matches that only occur mid-string
	function matchRank(needle: string, ...candidates: string[]) {
		return candidates.some((candidate) => candidate.toLowerCase().startsWith(needle)) ? 0 : 1;
	}

	let results = $derived.by<Result[]>(() => {
		const needle = query.trim().toLowerCase();
		if (!needle) return [];

		const rooms = $navigablePages
			.filter((room) => room.name.toLowerCase().includes(needle))
			.map((room) => ({
				result: { kind: 'room', id: room.id, name: room.name, icon: room.icon } as Result,
				rank: matchRank(needle, room.name)
			}));

		const entities = Object.entries($states ?? {})
			.map(([entityId, entity]) => ({
				entityId,
				name: String(entity.attributes?.friendly_name ?? entityId),
				state: entity.state
			}))
			.filter(
				(entry) =>
					entry.name.toLowerCase().includes(needle) || entry.entityId.toLowerCase().includes(needle)
			)
			.map((entry) => ({
				result: {
					kind: 'entity',
					entityId: entry.entityId,
					name: entry.name,
					state: entry.state
				} as Result,
				rank: matchRank(needle, entry.name, entry.entityId)
			}));

		const sort = (a: { rank: number; result: Result }, b: { rank: number; result: Result }) =>
			a.rank - b.rank || a.result.name.localeCompare(b.result.name);

		return [
			...rooms.sort(sort).map((entry) => entry.result),
			...entities
				.sort(sort)
				.slice(0, MAX_ENTITY_RESULTS)
				.map((entry) => entry.result)
		];
	});

	// query changes invalidate the previous selection position
	$effect(() => {
		void results;
		activeIndex = 0;
	});

	$effect(() => {
		rowEls[activeIndex]?.scrollIntoView({ block: 'nearest' });
	});

	// scenes and scripts run straight from the list, like a command palette
	function runnable(result: Result): boolean {
		return result.kind === 'entity' && ['scene', 'script'].includes(result.entityId.split('.')[0]);
	}

	function runResult(result: Result) {
		if (result.kind !== 'entity') return;
		onclose();
		runSurfaceAction(
			{
				action: 'perform-action',
				perform_action: `${result.entityId.split('.')[0]}.turn_on`,
				target: { entity_id: result.entityId }
			},
			{ entity: result.entityId, fallback: () => {} }
		);
	}

	function selectResult(result: Result) {
		if (result.kind === 'room') {
			goToPage(result.id);
			onclose();
		} else {
			// close first: the entity modal portals outside .frame
			onclose();
			openEntityDetail(result.entityId, result.name);
		}
	}

	let input = $state<HTMLInputElement>();

	function focusOnMount(node: HTMLInputElement) {
		node.focus();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			if (results.length) activeIndex = (activeIndex + 1) % results.length;
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			if (results.length) activeIndex = (activeIndex - 1 + results.length) % results.length;
		} else if (event.key === 'Enter' && event.target === input) {
			// a focused row or Run button answers Enter on its own
			event.preventDefault();
			const result = results[activeIndex];
			if (result && runnable(result)) runResult(result);
			else if (result) selectResult(result);
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div
	class="overlay"
	role="presentation"
	onpointerdown={(event) => (pressStartedOnBackdrop = event.target === event.currentTarget)}
	onclick={(event) => event.target === event.currentTarget && pressStartedOnBackdrop && onclose()}
	use:layer={{ close: onclose, trap: true }}
>
	<div class="panel" role="dialog" aria-modal="true" aria-label={$lang('search')}>
		<div class="search field-frame">
			<Icon name="search" size={ICON.control} />
			<input
				type="text"
				bind:value={query}
				bind:this={input}
				placeholder={$lang('hearth_search_placeholder')}
				aria-label={$lang('hearth_search_placeholder')}
				spellcheck="false"
				use:focusOnMount
			/>
			<CloseButton onclick={onclose} />
		</div>
		<div class="list">
			{#each results as result, index (result.kind === 'room' ? `room:${result.id}` : `entity:${result.entityId}`)}
				<div class="row" class:active={index === activeIndex}>
					<button
						type="button"
						class="row-main pressable"
						aria-current={index === activeIndex ? 'true' : undefined}
						use:Ripple={PRESS_RIPPLE}
						bind:this={rowEls[index]}
						onmouseenter={() => (activeIndex = index)}
						onfocus={() => (activeIndex = index)}
						onclick={() => selectResult(result)}
					>
						<span class="row-icon">
							<Icon
								name={result.kind === 'room' ? result.icon : domainIcon(result.entityId)}
								size={ICON.control}
							/>
						</span>
						<span class="row-text">
							<span class="row-name">{result.name}</span>
							<span class="row-id"
								>{result.kind === 'room' ? $lang('hearth_page') : result.entityId}</span
							>
						</span>
						{#if result.kind === 'entity' && !runnable(result)}
							<span class="row-state">{result.state}</span>
						{/if}
					</button>
					{#if runnable(result)}
						<button
							type="button"
							class="row-run pressable"
							onfocus={() => (activeIndex = index)}
							aria-label={fill($lang('hearth_run_named'), { name: result.name })}
							use:Ripple={PRESS_RIPPLE}
							onclick={() => runResult(result)}
						>
							<Icon name="play_arrow" size={ICON.inline} />
							{$lang('hearth_run')}
						</button>
					{/if}
				</div>
			{:else}
				<EmptyState
					inline
					icon={query.trim() ? 'search_off' : 'search'}
					text={query.trim() ? $lang('hearth_no_matches') : $lang('hearth_search_hint')}
				/>
			{/each}
		</div>
	</div>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		z-index: var(--h-layer-search);
		background: var(--h-overlay);
		backdrop-filter: blur(8px);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding-top: calc(12 * var(--h-dvh));
	}

	.panel {
		width: 480px;
		max-width: calc(100 * var(--h-vw) - 40px);
		max-height: calc(100 * var(--h-dvh) - 80px);
		display: flex;
		flex-direction: column;
		background: linear-gradient(180deg, var(--h-sheet-0), var(--h-sheet-1));
		border: 1px solid rgb(var(--h-accent-rgb) / calc(0.18 * var(--h-accent-scale)));
		border-radius: var(--h-radius-xl);
		padding: var(--h-modal-padding);
		box-shadow: var(--h-shadow-layer);
	}

	.search {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 0 14px;
		border-radius: var(--h-radius-xs);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.1 * var(--h-line-scale)));
		background: var(--h-track);
		color: var(--h-icon);
		margin-bottom: 12px;
		flex: none;
	}

	.search:focus-within {
		border-color: rgb(var(--h-accent-rgb) / calc(0.4 * var(--h-accent-scale)));
	}

	.search input {
		flex: 1;
		min-width: 0;
		padding: 12px 0;
		border: none;
		background: none;
		color: var(--h-text-2);
		font-family: inherit;
		font-size: var(--h-type-body);
		outline: none;
	}

	.search input::placeholder {
		color: var(--h-text-6);
	}

	/* iOS Safari zooms the page into any input set under 16px */
	@media (pointer: coarse) {
		.search input {
			font-size: max(var(--h-input-floor), var(--h-type-body));
		}
	}

	.list {
		flex: 1;
		overflow-y: auto;
		margin: 0 -6px;
		padding: 0 6px;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 8px;
		border-radius: var(--h-radius-xs);
	}

	.row-main {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 10px;
		border-radius: var(--h-radius-xs);
		cursor: pointer;
		border: 0;
		background: none;
		font: inherit;
		text-align: left;
	}

	.row-run {
		display: flex;
		align-items: center;
		flex: none;
		gap: 6px;
		margin-right: 6px;
		min-height: var(--h-touch-target);
		padding: 0 14px;
		border-radius: var(--h-radius-pill);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.09 * var(--h-line-scale)));
		background: rgb(var(--h-surface-rgb) / calc(0.05 * var(--h-fill-scale)));
		color: var(--h-text-3);
		font: inherit;
		font-size: var(--h-type-secondary);
		font-weight: 500;
		cursor: pointer;
	}

	.row.active {
		background: rgb(var(--h-surface-rgb) / calc(0.06 * var(--h-fill-scale)));
	}

	@media (hover: hover) {
		.row:hover {
			background: rgb(var(--h-surface-rgb) / calc(0.06 * var(--h-fill-scale)));
		}
	}

	.row-icon {
		display: flex;
		color: var(--h-icon);
	}

	.row-text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.row-name {
		font-size: var(--h-type-body);
		color: var(--h-text-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.row-id {
		font-family: var(--h-font-mono);
		font-size: var(--h-type-label);
		color: var(--h-text-5);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.row-state {
		max-width: 90px;
		font-size: var(--h-type-small);
		color: var(--h-text-5);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/*
	 * See breakpoints.ts: a full-width sheet like every other overlay. It
	 * hangs from the top rather than rising from the bottom, since the
	 * on-screen keyboard takes the bottom of the screen while typing.
	 */
	@media (max-width: 900px) {
		.overlay {
			padding: 0 var(--h-safe-right) 0 var(--h-safe-left);
		}

		.panel {
			width: 100%;
			max-width: none;
			/* the overlay's box, not the viewport's: an on-screen keyboard that
			   shrinks the page shrinks the overlay, and the results with it */
			max-height: 100%;
			border-top: 0;
			border-radius: 0 0 var(--h-radius-xl) var(--h-radius-xl);
			padding-top: calc(16px + var(--h-safe-top));
		}
	}
</style>
