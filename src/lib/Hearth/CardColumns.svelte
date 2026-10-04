<script lang="ts">
	import { fill as fillText, lang } from '$lib/core/i18n';
	import { sortable } from '$lib/ui/actions/sortable';
	import {
		cloneOverviewItem,
		findOverviewItemList,
		hasSpans,
		isStack,
		pruneEmptyStack,
		spanLayout,
		takenCardIds,
		type HearthConfig,
		type OverviewCard,
		type OverviewItem,
		type OverviewStack
	} from './config';
	import { fillWeight, cardDescriptor } from './cards';
	import { onDndReceive } from './drag';
	import { editTap } from './editTap';
	import { provideHearthInteractionMode } from './interaction';
	import { editor, hearthConfig, hearthEditMode, updateConfig } from './store';
	import AddControl from './AddControl.svelte';
	import CardRenderer from './CardRenderer.svelte';
	import EditChip from './EditChip.svelte';
	import VisibilityGate from './VisibilityGate.svelte';

	let {
		columns,
		locate,
		groupName,
		roomId,
		fill = false,
		clipToHeight = false
	}: {
		columns: OverviewItem[][];
		// resolves the mutable columns array inside a config draft, initializing
		// it if needed - all mutations below go through this
		locate: (config: HearthConfig) => OverviewItem[][];
		groupName: string;
		// the page these columns belong to; carried into every editor target
		roomId: string;
		fill?: boolean;
		// the page fills the screen: bound the grid so stretching cards share the
		// leftover height rather than the page growing a scrollbar
		clipToHeight?: boolean;
	} = $props();

	provideHearthInteractionMode(() => ($hearthEditMode ? 'layout-edit' : 'runtime'));

	// Alt-drop duplicate: gives the clone (and, for a stack, every child) a
	// fresh id the same way the "Add card" flow does.
	function cloneEntry<T extends OverviewItem>(item: T): T {
		return cloneOverviewItem(item, takenCardIds($hearthConfig));
	}

	function reorderColumn(column: number, items: OverviewItem[]) {
		updateConfig((config) => {
			locate(config)[column] = items.filter(Boolean);
		});
	}

	function reorderStack(columnIndex: number, stackId: string, items: OverviewCard[]) {
		updateConfig((config) => {
			const stack = locate(config)[columnIndex]?.find(
				(item): item is OverviewStack => isStack(item) && item.id === stackId
			);
			if (stack) stack.cards = items.filter(Boolean);
		});
	}

	// a card or stack dropped from another column/stack: move it in one
	// config update; the source's onEnd then finds nothing to remove and
	// no-ops. A stack left empty by the move goes with it. Alt-drop duplicates instead: the source keeps its item and the
	// target gets a clone with a fresh id.
	function receiveCard(column: number, id: string, newIndex: number, alt: boolean) {
		updateConfig((config) => {
			const sourceList = findOverviewItemList(config, id, roomId);
			if (!sourceList) return;
			const index = sourceList.findIndex((item) => item.id === id);
			if (index < 0) return;
			if (alt) {
				locate(config)[column].splice(
					newIndex,
					0,
					cloneOverviewItem(sourceList[index], takenCardIds(config))
				);
			} else {
				const [item] = sourceList.splice(index, 1);
				locate(config)[column].splice(newIndex, 0, item);
				pruneEmptyStack(config, sourceList);
			}
		});
	}

	// same idea as receiveCard, but the target is a stack's children list.
	// Stacks can never receive a stack - blocked at the sortable group's
	// `put` check below, and re-checked here for safety.
	function receiveIntoStack(
		columnIndex: number,
		stackId: string,
		id: string,
		newIndex: number,
		alt: boolean
	) {
		updateConfig((config) => {
			const stack = locate(config)[columnIndex]?.find(
				(item): item is OverviewStack => isStack(item) && item.id === stackId
			);
			if (!stack) return;
			const sourceList = findOverviewItemList(config, id, roomId);
			if (!sourceList) return;
			const index = sourceList.findIndex((item) => item.id === id);
			if (index < 0) return;
			const source = sourceList[index];
			if (isStack(source)) return;
			if (alt) {
				stack.cards.splice(newIndex, 0, cloneOverviewItem(source, takenCardIds(config)));
			} else {
				sourceList.splice(index, 1);
				stack.cards.splice(newIndex, 0, source);
				pruneEmptyStack(config, sourceList);
			}
		});
	}

	// a tap on a card, or on a stack around its cards, opens that one's editor
	function openTapped(target: Element): boolean {
		const slot = target.closest<HTMLElement>('.card-slot, .stack-slot');
		const id = slot?.dataset.id;
		if (!slot || !id) return false;
		if (slot.classList.contains('card-slot')) {
			editor.set({ kind: 'card', roomId, id });
			return true;
		}
		for (const [column, items] of columns.entries()) {
			const index = items.findIndex((item) => item.id === id);
			if (index < 0) continue;
			editor.set({ kind: 'stack', roomId, column, index });
			return true;
		}
		return false;
	}

	function addStack(column: number) {
		editor.set({ kind: 'stack', roomId, column, index: null });
	}

	function cardName(card: OverviewCard): string {
		const title = 'title' in card && typeof card.title === 'string' ? card.title.trim() : '';
		return title || $lang(cardDescriptor(card.type).name);
	}

	/*
	 * Cards that span columns lay the page out in rows; see spanLayout. Only
	 * outside the editor: dragging works on whole columns, so while editing a
	 * spanning card stays in its own column like any other.
	 */
	let spanned = $derived(!$hearthEditMode && columns.length > 1 && hasSpans(columns));
	let layout = $derived(spanned ? spanLayout(columns) : undefined);
	let rowTemplate = $derived(
		layout?.rows
			.map((kind) => (kind === 'run' && clipToHeight ? 'minmax(0, 1fr)' : 'auto'))
			.join(' ')
	);

	// a stack's own sortable container refuses drops of another stack (no
	// nesting); everything else in the shared group is welcome
	const stackGroup = $derived({
		name: groupName,
		put: (_to: unknown, _from: unknown, dragEl: HTMLElement) => dragEl.dataset.cardType !== 'stack'
	});
</script>

{#snippet cardSlot(card: OverviewCard, target: { kind: 'card'; roomId: string; id: string })}
	<VisibilityGate conditions={card.visibility}>
		{#snippet children(visible)}
			{#if $hearthEditMode || visible}
				<div
					class="card-slot"
					data-id={card.id}
					data-card-type={card.type}
					style:--card-min-height={cardDescriptor(card.type).stretchMinHeight
						? `${cardDescriptor(card.type).stretchMinHeight}px`
						: undefined}
					class:stretch={fillWeight(card) > 0}
					style:--card-fill={fillWeight(card)}
					class:visibility-dimmed={$hearthEditMode && !visible}
				>
					{#if $hearthEditMode}
						<EditChip
							label={fillText($lang('hearth_edit_named'), { name: cardName(card) })}
							onedit={() => editor.set(target)}
						/>
					{/if}
					<CardRenderer {card} />
				</div>
			{/if}
		{/snippet}
	</VisibilityGate>
{/snippet}

{#snippet overviewItem(item: OverviewItem, columnIndex: number, index: number)}
	{#if isStack(item)}
		<div
			class="stack-slot"
			class:stretch={fillWeight(item) > 0}
			style:--card-fill={fillWeight(item)}
			data-id={item.id}
			data-card-type="stack"
		>
			<!-- while editing the row holds the stack's chip after the title, so
			     it never sits on a card or the title; an untitled stack gets
			     the row only then -->
			{#if item.title || $hearthEditMode}
				<div class="group-label" class:untitled={!item.title}>
					<span class="group-title">
						{item.title ?? ''}
						{#if $hearthEditMode}
							<EditChip
								label={item.title?.trim()
									? fillText($lang('hearth_edit_named'), { name: item.title.trim() })
									: $lang('hearth_edit_stack')}
								kind={$lang('hearth_stack')}
								after
								onedit={() => editor.set({ kind: 'stack', column: columnIndex, index, roomId })}
							/>
						{/if}
					</span>
				</div>
			{/if}
			<div
				class="stack"
				class:vertical={item.direction === 'vertical'}
				use:sortable={{
					group: stackGroup,
					handle: '.drag-handle',
					filter: '.add-tile',
					disabled: !$hearthEditMode,
					clone: true,
					cloneItem: cloneEntry,
					items: item.cards,
					onFinalize: (items: OverviewCard[]) => reorderStack(columnIndex, item.id, items)
				}}
				use:onDndReceive={(detail) =>
					receiveIntoStack(columnIndex, item.id, detail.id, detail.newIndex, detail.alt ?? false)}
			>
				{#each item.cards as card (card.id)}
					{@render cardSlot(card, {
						kind: 'card',
						roomId,
						id: card.id
					})}
				{/each}
				{#if $hearthEditMode}
					<AddControl
						label={$lang('hearth_add_card')}
						onadd={() =>
							editor.set({
								kind: 'card',
								column: columnIndex,
								id: null,
								roomId,
								stackId: item.id
							})}
					/>
				{/if}
			</div>
		</div>
	{:else}
		{@render cardSlot(item, { kind: 'card', id: item.id, roomId })}
	{/if}
{/snippet}

{#if layout}
	<div
		class="overview spanned"
		class:fill
		class:clip={clipToHeight}
		style:--overview-columns={columns.length}
		style:--span-rows={rowTemplate}
	>
		{#each layout.cells as cell (cell.kind === 'run' ? `run-${cell.column}-${cell.row}` : cell.card.id)}
			<div
				class={cell.kind === 'run' ? 'column' : 'span-cell'}
				style:--row={cell.row}
				style:--start={cell.kind === 'run' ? cell.column + 1 : cell.start}
				style:--span={cell.kind === 'run' ? 1 : cell.span}
				style:--order={cell.order}
			>
				{#if cell.kind === 'run'}
					{#each cell.items as item (item.id)}
						{@render overviewItem(item, cell.column, columns[cell.column].indexOf(item))}
					{/each}
				{:else}
					{@render cardSlot(cell.card, { kind: 'card', id: cell.card.id, roomId })}
				{/if}
			</div>
		{/each}
	</div>
{:else}
	<div
		class="overview"
		class:fill
		class:clip={clipToHeight}
		class:editing={$hearthEditMode}
		style:--overview-columns={columns.length}
		use:editTap={{ enabled: $hearthEditMode, open: openTapped }}
	>
		{#each columns as column, columnIndex (columnIndex)}
			<div
				class="column"
				use:sortable={{
					group: groupName,
					handle: '.drag-handle',
					filter: '.add-tile',
					disabled: !$hearthEditMode,
					clone: true,
					cloneItem: cloneEntry,
					items: column,
					onFinalize: (items: OverviewItem[]) => reorderColumn(columnIndex, items)
				}}
				use:onDndReceive={(detail) =>
					receiveCard(columnIndex, detail.id, detail.newIndex, detail.alt ?? false)}
			>
				{#each column as item, index (item.id)}
					{@render overviewItem(item, columnIndex, index)}
				{/each}
				{#if $hearthEditMode}
					<AddControl
						label={$lang('hearth_add_card')}
						onadd={() => editor.set({ kind: 'card', column: columnIndex, id: null, roomId })}
					/>
					<AddControl label={$lang('hearth_add_stack')} onadd={() => addStack(columnIndex)} />
				{/if}
			</div>
		{/each}
	</div>
{/if}

<style>
	.overview {
		display: grid;
		/* minmax(0, 1fr): a column never grows past its share to fit a tile
		   grid's min-content, which would push the page past the viewport */
		grid-template-columns: repeat(var(--overview-columns, 2), minmax(0, 1fr));
		gap: 32px;
	}

	/* grow into the page's leftover height. It has to be flex-grow: the grid is a
	   flex item of a page whose own height is auto, so a percentage min-height
	   resolves against nothing and is silently ignored. */
	.overview.fill {
		flex: 1 0 auto;
	}

	.overview.clip {
		flex: 1;
		min-height: 0;
		overflow: hidden;
		/* the implicit row must be exactly the container height: an auto row
		   sizes to the tallest column, which would inflate every other column's
		   filling cards and push content past the clipped edge with the
		   per-column scroll never engaging */
		grid-auto-rows: minmax(0, 1fr);
	}

	.overview.clip .column {
		min-height: 0;
		overflow-y: auto;
		scrollbar-width: thin;
	}

	/* rows of runs and spanning cards; the custom properties come from
	   spanLayout, so the folded layout below can undo them */
	.overview.spanned {
		grid-template-rows: var(--span-rows);
		row-gap: 18px;
	}

	.overview.spanned > .column,
	.overview.spanned > .span-cell {
		grid-row: var(--row);
		grid-column: var(--start) / span var(--span);
	}

	.span-cell {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	/* collapse to one column only when the page itself is too narrow for two
	   readable ones - two ~265px columns is the floor; tiles inside reflow on
	   their own well below that. Stacked columns then scroll as one page;
	   screen-height rows would squeeze each column into a fraction of the
	   viewport. */
	@container hearth-page (max-width: 560px) {
		.overview {
			grid-template-columns: minmax(0, 1fr);
		}

		/* spans mean nothing in one column: every card reads where it is stored */
		.overview.spanned {
			grid-template-rows: none;
		}

		.overview.spanned > .column,
		.overview.spanned > .span-cell {
			grid-row: auto;
			grid-column: auto;
			order: var(--order);
		}

		.overview.clip {
			grid-auto-rows: auto;
			overflow: visible;
		}

		.overview.clip .column {
			overflow-y: visible;
		}
	}

	/* same collapse for browsers without container queries; the viewport
	   threshold accounts for the rail, gap and padding around the page */
	@supports not (container-type: inline-size) {
		@media (max-width: 1200px) {
			.overview {
				grid-template-columns: minmax(0, 1fr);
			}

			.overview.spanned {
				grid-template-rows: none;
			}

			.overview.spanned > .column,
			.overview.spanned > .span-cell {
				grid-row: auto;
				grid-column: auto;
				order: var(--order);
			}

			.overview.clip {
				grid-auto-rows: auto;
				overflow: visible;
			}

			.overview.clip .column {
				overflow-y: visible;
			}
		}
	}

	.column {
		display: flex;
		flex-direction: column;
		gap: 18px;
		min-height: 0;
		min-width: 0;
	}

	.card-slot {
		position: relative;
	}

	/* a filling slot starts at its content height and takes its share of the
	   column's leftover on top - basis 0 would let a tall neighbouring column
	   compress the card below its content and paint the chart past the card.
	   Only a height-bounded column (fill_screen) may shrink it, down to the
	   floor that keeps it from becoming an unreadable sliver */
	.card-slot.stretch,
	.stack-slot.stretch {
		flex: var(--card-fill, 1) 1 auto;
		min-height: var(--card-min-height, 90px);
	}

	/* the card inside has to follow the slot rather than its own content */
	.card-slot.stretch > :global(.section),
	.card-slot.stretch > :global(.card) {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
	}

	/* the card absorbs the slack, its tiles do not: rows keep their natural
	   height and the leftover sits below them (an entity grid draws no
	   background, so that space is invisible). Too little room scrolls. */
	.card-slot.stretch :global(.grid) {
		flex: 1;
		min-height: 0;
		grid-auto-rows: minmax(44px, min-content);
		align-content: start;
		overflow-y: auto;
	}

	.card-slot.stretch :global(.grid) > :global(*) {
		min-height: 0;
	}

	.card-slot.visibility-dimmed {
		opacity: 0.45;
	}

	.stack-slot {
		position: relative;
	}

	/* a stack draws no frame of its own; while editing it gets one, so it
	   reads as the container its chip edits. The outline takes no layout. */
	.overview.editing .stack-slot {
		outline: 1px dashed rgb(var(--h-accent-rgb) / calc(0.35 * var(--h-accent-scale)));
		outline-offset: 8px;
		border-radius: var(--h-radius-md);
	}

	.overview.editing .card-slot,
	.overview.editing .stack-slot {
		cursor: pointer;
	}

	/* a tap inside embedded content never reaches the page, so while editing
	   it falls through to the card and opens its editor */
	.overview.editing :global(:is(iframe, video, object, embed)) {
		pointer-events: none;
	}

	/* the chip's anchor: it rides just past the end of the title */
	.group-title {
		position: relative;
		display: inline-block;
	}

	/* the chip's height, so an untitled stack's row does not crop it */
	.group-label.untitled .group-title {
		height: 20px;
	}

	.group-label {
		font-family: var(--h-font-mono);
		font-size: var(--h-type-label);
		letter-spacing: 2px;
		text-transform: uppercase;
		color: var(--h-label);
		margin: 0 0 10px;
	}

	.stack {
		display: flex;
		gap: 18px;
	}

	.stack:not(.vertical) {
		flex-direction: row;
		flex-wrap: wrap;
	}

	.stack:not(.vertical) > .card-slot {
		flex: 1 1 200px;
		min-width: 0;
	}

	.stack.vertical {
		flex-direction: column;
	}
</style>
