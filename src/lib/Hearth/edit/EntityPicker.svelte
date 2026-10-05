<script lang="ts">
	import { ICON } from '../iconSizes';
	import { lang, fill } from '$lib/core/i18n';
	import { activateOnKeyboard } from '../interaction';
	import { states } from '$lib/core/ha/entities';
	import { finePointer } from '$lib/core/app/pointer';
	import { autofocus } from '$lib/ui/actions/autofocus';
	import Ripple from '$lib/ui/actions/ripple';
	import StateLogic from '$lib/ui/StateLogic.svelte';
	import { PRESS_RIPPLE } from '../config';
	import { domainIcon } from '$lib/core/domains';
	import Icon from '../Icon.svelte';
	import CloseButton from '../CloseButton.svelte';
	import { layer } from '$lib/ui/layers';
	import { confirmDiscard } from './discard';
	import {
		entityEntries,
		entryBuilder,
		loadEntityPlaces,
		matchesQuery,
		orderEntries,
		queryWords,
		recentEntities,
		rememberEntities,
		topAreas,
		type EntityPlace
	} from './entityDirectory';
	import '../buttons.css';

	let {
		domains = [],
		deviceClass = undefined,
		multiple = false,
		taken = [],
		onselect = undefined,
		onselectmany = undefined,
		onclose
	}: {
		domains?: string[];
		/** Entities of this device_class (or a fitting unit) are listed first, such as temperature sensors. */
		deviceClass?: string;
		/** Rows toggle instead of closing the picker, and one confirm hands over the picks in order. */
		multiple?: boolean;
		/** Already in the list being added to: shown as added and not pickable again. */
		taken?: string[];
		onselect?: (entityId: string) => void;
		onselectmany?: (entityIds: string[]) => void;
		onclose: () => void;
	} = $props();

	const uid = $props.id();
	const MAX_ROWS = 100;
	const recent = recentEntities();

	let query = $state('');
	// the row Enter picks, moved with the arrow keys while focus stays in the search
	let active = $state(0);
	let listbox = $state<HTMLElement>();
	let areaId = $state<string | null>(null);
	let picked = $state<string[]>([]);
	let places = $state<Map<string, EntityPlace>>();

	// without a connection the picker still searches names and ids
	loadEntityPlaces()
		.then((loaded) => (places = loaded))
		.catch(() => {});

	let build = $derived(entryBuilder(places));
	let entries = $derived(entityEntries($states ?? {}, { domains, deviceClass, recent, build }));
	// from every entry rather than the matches, so the chips hold still while typing
	let areas = $derived(topAreas(entries));
	let words = $derived(queryWords(query));
	let matches = $derived(
		orderEntries(
			entries.filter((entry) => (!areaId || entry.areaId === areaId) && matchesQuery(entry, words)),
			query,
			recent
		)
	);

	let visible = $derived(matches.slice(0, MAX_ROWS));
	let activeIndex = $derived(Math.min(active, visible.length - 1));

	$effect(() => {
		listbox?.children[activeIndex]?.scrollIntoView?.({ block: 'nearest' });
	});

	function choose(entityId: string) {
		if (taken.includes(entityId)) return;
		if (multiple) {
			picked = picked.includes(entityId)
				? picked.filter((entry) => entry !== entityId)
				: [...picked, entityId];
			return;
		}
		rememberEntities([entityId]);
		onselect?.(entityId);
		onclose();
	}

	function confirm() {
		if (!picked.length) return;
		rememberEntities(picked);
		onselectmany?.(picked);
		onclose();
	}

	// unconfirmed picks are work a stray Escape or backdrop tap must not drop
	function close() {
		confirmDiscard(picked.length > 0, onclose);
	}

	function toggleArea(id: string) {
		areaId = areaId === id ? null : id;
		active = 0;
	}

	function navigate(event: KeyboardEvent) {
		// Enter that confirms an input method composition is not a pick
		if (event.isComposing) return;
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			const step = event.key === 'ArrowDown' ? 1 : -1;
			active = Math.max(0, Math.min(visible.length - 1, activeIndex + step));
		} else if (event.key === 'Enter' && multiple && (event.ctrlKey || event.metaKey)) {
			event.preventDefault();
			confirm();
		} else if (event.key === 'Enter' && visible[activeIndex]) {
			event.preventDefault();
			choose(visible[activeIndex].entityId);
		}
	}
</script>

<div
	class="overlay"
	onclick={(event) => event.target === event.currentTarget && close()}
	role="presentation"
	use:layer={{
		close,
		trap: true,
		// without the search taking focus on a touch screen, the dialog itself does
		initialFocus: (node) => (finePointer() ? null : node.querySelector<HTMLElement>('.panel'))
	}}
>
	<div
		class="panel"
		role="dialog"
		aria-modal="true"
		aria-label={$lang('hearth_choose_entity')}
		tabindex="-1"
	>
		<div class="search">
			<Icon name="search" size={ICON.control} />
			<input
				type="text"
				role="combobox"
				aria-label={$lang('hearth_search_entities')}
				aria-expanded="true"
				aria-controls="{uid}-list"
				aria-autocomplete="list"
				aria-activedescendant={visible.length ? `${uid}-option-${activeIndex}` : undefined}
				bind:value={query}
				placeholder={$lang('hearth_search_entities')}
				spellcheck="false"
				oninput={() => (active = 0)}
				onkeydown={navigate}
				use:autofocus
			/>
			<CloseButton onclick={close} />
		</div>
		{#if areas.length > 1}
			<div class="areas" role="group" aria-label={$lang('hearth_filter_by_area')}>
				{#each areas as area (area.id)}
					<button
						type="button"
						class="area-chip pressable"
						class:active={areaId === area.id}
						aria-pressed={areaId === area.id}
						onclick={() => toggleArea(area.id)}
					>
						{area.name}
					</button>
				{/each}
			</div>
		{/if}
		<div class="list">
			<div
				id="{uid}-list"
				role="listbox"
				aria-label={$lang('hearth_choose_entity')}
				aria-multiselectable={multiple || undefined}
				bind:this={listbox}
			>
				{#each visible as entry, index (entry.entityId)}
					{@const added = taken.includes(entry.entityId)}
					{@const chosen = added || picked.includes(entry.entityId)}
					<div
						id="{uid}-option-{index}"
						class="row pressable"
						class:active={index === activeIndex}
						class:added
						onpointermove={() => (active = index)}
						use:Ripple={PRESS_RIPPLE}
						onclick={() => choose(entry.entityId)}
						role="option"
						aria-selected={multiple ? chosen : index === activeIndex}
						aria-disabled={added || undefined}
						tabindex="-1"
						onkeydown={(event) => activateOnKeyboard(event, () => choose(entry.entityId))}
					>
						<span class="row-icon"
							><Icon name={domainIcon(entry.entityId)} size={ICON.control} /></span
						>
						<span class="row-text">
							<span class="row-name">{entry.name}</span>
							<span class="row-meta">
								{#if entry.named}<span class="row-id">{entry.entityId}</span>{/if}
								{#if entry.area}<span class="row-area">{entry.area}</span>{/if}
								{#if added}
									<span class="row-tag">{$lang('hearth_already_added')}</span>
								{:else if entry.recent && !query.trim()}
									<span class="row-tag">{$lang('hearth_recently_picked')}</span>
								{/if}
							</span>
						</span>
						<span class="row-state"><StateLogic entity_id={entry.entityId} /></span>
						{#if multiple}
							<span class="row-check" class:chosen>
								<Icon name={chosen ? 'check_box' : 'check_box_outline_blank'} size={ICON.control} />
							</span>
						{/if}
					</div>
				{/each}
			</div>
			{#if !visible.length}
				<div class="hint">{$lang('hearth_no_matching_entities')}</div>
			{/if}
			{#if matches.length > MAX_ROWS}
				<div class="hint">
					{fill($lang('hearth_more_matches'), { count: matches.length - MAX_ROWS })}
				</div>
			{/if}
		</div>
		{#if multiple}
			<div class="footer">
				<span class="picked-count" role="status">
					{fill($lang('hearth_entities_picked'), { count: picked.length })}
				</span>
				<button
					type="button"
					class="hearth-button primary pressable"
					disabled={!picked.length}
					use:Ripple={PRESS_RIPPLE}
					onclick={confirm}
				>
					{$lang('hearth_add_picked_entities')}
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		z-index: var(--h-layer-picker);
		background: var(--h-overlay);
		backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.panel {
		width: min(720px, calc(100 * var(--h-vw) - 32px));
		height: min(720px, calc(100 * var(--h-dvh) - 48px));
		display: flex;
		flex-direction: column;
		background: radial-gradient(620px 420px at 25% -10%, var(--h-sheet-0), var(--h-sheet-1) 60%);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.08 * var(--h-line-scale)));
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
		scrollbar-gutter: stable;
		margin: 0 -6px;
		padding: 0 6px;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 10px;
		border-radius: var(--h-radius-xs);
		cursor: pointer;
	}

	/* the pointer moves the highlight too, so only one row is lit; on move
	   rather than enter, so rows scrolling under a resting pointer keep the
	   keyboard's choice */
	.row.active {
		background: rgb(var(--h-surface-rgb) / calc(0.06 * var(--h-fill-scale)));
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

	.row-meta {
		display: flex;
		align-items: baseline;
		gap: 8px;
		min-width: 0;
		font-size: var(--h-type-label);
		color: var(--h-text-5);
		white-space: nowrap;
	}

	/* the id gives way first; the area beside it is the shorter clue */
	.row-id {
		min-width: 0;
		font-family: var(--h-font-mono);
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.row-area,
	.row-tag {
		flex: none;
	}

	.row-tag {
		color: var(--h-accent-text);
	}

	.row.added {
		cursor: default;
		opacity: 0.6;
	}

	.row-check {
		display: flex;
		color: var(--h-icon-dim);
	}

	.row-check.chosen {
		color: var(--h-accent-icon);
	}

	.areas {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 12px;
	}

	.area-chip {
		padding: 6px 12px;
		border-radius: var(--h-radius-card);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.1 * var(--h-line-scale)));
		background: none;
		color: var(--h-text-4);
		font-family: inherit;
		font-size: var(--h-type-secondary);
		cursor: pointer;
	}

	.area-chip.active {
		background: rgb(var(--h-accent-rgb) / calc(0.12 * var(--h-accent-scale)));
		border-color: rgb(var(--h-accent-rgb) / calc(0.25 * var(--h-accent-scale)));
		color: var(--h-accent-icon);
	}

	/* the interface scale must not shrink it under a finger */
	@media (pointer: coarse) {
		.area-chip {
			min-height: var(--h-touch-target);
		}
	}

	.footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding-top: 12px;
		border-top: 1px solid rgb(var(--h-line-rgb) / calc(0.06 * var(--h-line-scale)));
	}

	.picked-count {
		font-size: var(--h-type-small);
		color: var(--h-text-4);
	}

	.row-state {
		max-width: 90px;
		font-size: var(--h-type-small);
		color: var(--h-text-5);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.hint {
		padding: 12px 10px;
		font-size: var(--h-type-small);
		color: var(--h-text-4);
		text-align: center;
	}

	/* see breakpoints.ts */
	@media (max-width: 900px) {
		.overlay {
			align-items: stretch;
			/* the insets keep an installed app's status bar, home indicator and a
			   landscape cutout off the panel's edges */
			padding: calc(8px + var(--h-safe-top)) calc(8px + var(--h-safe-right))
				calc(8px + var(--h-safe-bottom)) calc(8px + var(--h-safe-left));
		}

		/* stretched rather than sized from the viewport, so it follows the
		   overlay when an on-screen keyboard shrinks the page */
		.panel {
			width: 100%;
			height: auto;
			padding: 16px;
			border-radius: var(--h-radius-md);
		}
	}
</style>
