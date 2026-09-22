<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import { sortable } from '$lib/ui/actions/sortable';
	import { onDndReceive, type DndReceiveDetail } from './drag';
	import {
		mobileSlotOf,
		placeInSlot,
		railDividerIndex,
		railSlots,
		reorderSlot,
		slugify,
		uniqueId,
		type MobileSlot,
		type RailWidget
	} from './config';
	import { editor, hearthConfig, hearthEditMode, updateConfig } from './store';
	import AddControl from './AddControl.svelte';
	import EditChip from './EditChip.svelte';
	import RailWidgetRenderer from './RailWidgetRenderer.svelte';
	import VisibilityGate from './VisibilityGate.svelte';

	/**
	 * The whole rail, or one of the two runs the folded layout splits it into.
	 * Both runs share a drag group, so moving a widget past the page is how you
	 * change its slot by hand.
	 */
	let {
		onsearch,
		mobileSlot,
		compact = false
	}: {
		onsearch: () => void;
		mobileSlot?: Exclude<MobileSlot, 'hidden'>;
		compact?: boolean;
	} = $props();

	let dividerIndex = $derived(railDividerIndex($hearthConfig.rail));
	let indexOfId = $derived(
		new Map($hearthConfig.rail.map((widget, index) => [widget.id, index] as const))
	);

	let widgets = $derived(
		mobileSlot
			? railSlots($hearthConfig.rail, { includeHidden: $hearthEditMode, compact })[mobileSlot]
			: $hearthConfig.rail
	);

	function railIndex(widget: RailWidget): number {
		return indexOfId.get(widget.id) ?? 0;
	}

	function hiddenHere(widget: RailWidget): boolean {
		return !!mobileSlot && mobileSlotOf(widget, railIndex(widget), dividerIndex) === 'hidden';
	}

	function commit(items: RailWidget[]) {
		updateConfig((config) => {
			config.rail = mobileSlot ? reorderSlot(config.rail, mobileSlot, items) : items;
		});
	}

	/*
	 * A widget dragged in from the other run. SortableJS reverts the DOM and
	 * leaves the data to us, so the drop is what assigns the slot.
	 */
	function receive(detail: DndReceiveDetail) {
		if (!mobileSlot) return;
		const slot = mobileSlot;
		updateConfig((config) => {
			config.rail = placeInSlot(config.rail, detail.id, slot, detail.newIndex, {
				copy: detail.alt ?? false,
				compact
			});
		});
	}
</script>

<div
	class="rail"
	class:slotted={mobileSlot !== undefined}
	use:sortable={{
		group: 'hearth-rail',
		handle: '.drag-handle',
		filter: '.add-tile',
		disabled: !$hearthEditMode,
		clone: true,
		cloneItem: (widget: RailWidget) => {
			const cloned = structuredClone(widget);
			cloned.id = uniqueId(
				slugify(widget.type),
				$hearthConfig.rail.map((entry) => entry.id)
			);
			return cloned;
		},
		items: widgets,
		onFinalize: commit
	}}
	use:onDndReceive={receive}
>
	{#each widgets as widget (widget.id)}
		<VisibilityGate conditions={widget.visibility}>
			{#snippet children(visible)}
				{#if $hearthEditMode || visible}
					<div
						class="widget"
						class:spacer={widget.type === 'spacer' && !widget.height}
						class:spacer-visible={widget.type === 'spacer' && $hearthEditMode}
						class:visibility-dimmed={$hearthEditMode && (!visible || hiddenHere(widget))}
						class:in-switcher={(widget.type === 'nav' || widget.type === 'search') &&
							!$hearthEditMode}
						data-id={widget.id}
					>
						{#if $hearthEditMode}
							<EditChip
								onedit={() => editor.set({ kind: 'railWidget', index: railIndex(widget) })}
							/>
						{/if}
						<RailWidgetRenderer {widget} {onsearch} />
					</div>
				{/if}
			{/snippet}
		</VisibilityGate>
	{/each}
	{#if $hearthEditMode && mobileSlot !== 'top'}
		<AddControl
			label={$lang('hearth_add_widget')}
			onadd={() => editor.set({ kind: 'railWidget', index: null })}
		/>
	{/if}
</div>

<style>
	.rail {
		display: flex;
		flex-direction: column;
		/* fill the rail-scroll viewport so spacer widgets have space to absorb,
		   but never shrink below content height - overflow scrolls instead */
		flex: 1 0 auto;
	}

	/* a folded run takes its height from its widgets; there is no leftover for
	   a flexible gap to absorb, and growing would push the page off-screen */
	.rail.slotted {
		flex: 0 0 auto;
	}

	.widget {
		position: relative;
	}

	.widget.spacer {
		display: flex;
		flex-direction: column;
		flex: 1;
	}

	/* room for the edit chip, even on a thin fixed gap */
	.widget.spacer-visible {
		display: flex;
		flex-direction: column;
		min-height: 40px;
	}

	/* a flexible gap has nothing to absorb in a folded run, and an empty drop
	   target still needs to be grabbable */
	.rail.slotted .widget.spacer {
		flex: 0 0 auto;
	}

	.widget.visibility-dimmed {
		opacity: 0.45;
	}

	/* the folded layout's page switcher already carries the pages and search */
	.rail.slotted .widget.in-switcher {
		display: none;
	}
</style>
