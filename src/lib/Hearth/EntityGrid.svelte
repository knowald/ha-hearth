<script lang="ts">
	import { ICON } from './iconSizes';
	import { lang } from '$lib/core/i18n';
	import { sortable } from '$lib/ui/actions/sortable';
	import type { EntityRef } from './config';
	import type { SliderUpdateMode } from '$lib/core/app/configuration';
	import { onDndReceive } from './drag';
	import { displayTimeZone, hearthEditMode } from './store';
	import EntityTile from './EntityTile.svelte';
	import Icon from './Icon.svelte';
	import StatTile from './StatTile.svelte';
	import TileTemplates from './TileTemplates.svelte';
	import { minuteTimer } from '$lib/core/app/clock';
	import { deviceName } from '$lib/core/app/device';
	import { states } from '$lib/core/ha/entities';
	import { matchStyleRule, styleColor, usesTime } from './visibility';

	let {
		entities,
		cardId = undefined,
		style = 'tile',
		columns = undefined,
		compact = false,
		readonly = false,
		sliderUpdates = 'continuous',
		tuneButton = false,
		// two tracks must survive a two-column page on a padded tablet: page
		// columns bottom out around 350px, and 2x160+gap still fits there
		minTileWidth = 160,
		showDragHandles = true,
		onreorder = undefined,
		onreceive = undefined
	}: {
		entities: EntityRef[];
		/** Enables edit-mode sorting and uniquely identifies this card's entities. */
		cardId?: string;
		style?: 'tile' | 'stat';
		columns?: number;
		compact?: boolean;
		/** card-wide default; an entity's own `readonly` wins */
		readonly?: boolean;
		sliderUpdates?: SliderUpdateMode;
		/** restores the per-tile controls glyph beside the long-press gesture */
		tuneButton?: boolean;
		minTileWidth?: number;
		showDragHandles?: boolean;
		onreorder?: (entities: EntityRef[]) => void;
		onreceive?: (token: string, newIndex: number) => void;
	} = $props();

	const entityGroup = 'hearth-card-entities';

	// the shared minute clock runs only for grids with a time-based style rule
	let timed = $derived(
		entities.some((ref) => ref.style?.some((rule) => usesTime(rule.conditions)))
	);
	let now = $state<Date | undefined>();
	$effect(() => {
		if (!timed) {
			now = undefined;
			return;
		}
		return minuteTimer.subscribe((value) => (now = value));
	});
	// a grid without style rules never reads the states for them
	let styled = $derived(entities.some((ref) => ref.style?.length));
	let styleRules = $derived(
		styled
			? entities.map((ref) =>
					matchStyleRule(ref.style, $states, {
						device: $deviceName,
						now,
						timeZone: $displayTimeZone
					})
				)
			: []
	);

	// a tablet card's four tracks would leave phone tiles too narrow to read
	const FOLDED_MAX_COLUMNS = 2;
</script>

<div
	class="grid"
	class:editing={$hearthEditMode && Boolean(cardId) && showDragHandles}
	class:empty={entities.length === 0}
	class:fixed={Boolean(columns)}
	style:--min-tile-width="{minTileWidth}px"
	style:--columns={columns || undefined}
	style:--folded-columns={columns ? Math.min(columns, FOLDED_MAX_COLUMNS) : undefined}
	use:sortable={{
		group: entityGroup,
		handle: '.entity-drag-handle',
		disabled: !$hearthEditMode || !cardId || !showDragHandles,
		items: entities,
		onFinalize: (items: EntityRef[]) => onreorder?.(items)
	}}
	use:onDndReceive={(detail) => onreceive?.(detail.id, detail.newIndex)}
>
	<!-- keyed by entity (index breaks the tie for duplicates): reusing a tile for
	     a different entity can leave StateLogic showing the previous state -->
	{#each entities as ref, index (`${ref.entity}-${index}`)}
		{@const rule = styleRules[index]}
		{@const accent = styleColor(rule?.color)}
		<!-- a matching style rule's class goes on the slot, its color reaches the
		     tile through --tile-accent -->
		<div
			class="entity-slot {rule?.class ?? ''}"
			class:styled={accent !== undefined}
			style:--tile-accent={accent}
			data-id={JSON.stringify([cardId, index])}
		>
			{#if $hearthEditMode && cardId && showDragHandles}
				<div class="entity-drag-handle" role="img" aria-label={$lang('hearth_rearrange_entity')}>
					<Icon name="drag_indicator" size={ICON.inline} />
				</div>
			{/if}
			<TileTemplates nameTemplate={ref.name_template} stateTemplate={ref.state_template}>
				{#snippet children(templatedName, templatedState)}
					{#if (ref.display ?? style) === 'stat'}
						<StatTile
							entity={ref.entity}
							name={templatedName ?? ref.name}
							stateOverride={templatedState}
							verdictBands={ref.verdict}
							readonly={ref.readonly ?? readonly}
							tapAction={ref.tap_action}
							holdAction={ref.hold_action}
						/>
					{:else}
						<EntityTile
							entity={ref.entity}
							name={templatedName ?? ref.name}
							stateOverride={templatedState}
							icon={rule?.icon || ref.icon}
							readonly={ref.readonly ?? readonly}
							activeEntity={ref.active_entity}
							activeStates={ref.active_states}
							sliderUpdates={ref.slider_updates ?? sliderUpdates}
							showTune={tuneButton}
							tapAction={ref.tap_action}
							holdAction={ref.hold_action}
							{compact}
						/>
					{/if}
				{/snippet}
			</TileTemplates>
		</div>
	{/each}
</div>

<style>
	.grid {
		display: grid;
		/* the min() keeps a track from outgrowing a container narrower than
		   the minimum, which would push tiles past the card's edge */
		grid-template-columns: repeat(auto-fill, minmax(min(var(--min-tile-width), 100%), 1fr));
		gap: 12px;
	}

	.grid.fixed {
		grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
	}

	.grid.editing.empty {
		min-height: 62px;
		border: 1px dashed rgb(var(--h-line-rgb) / calc(0.15 * var(--h-line-scale)));
		border-radius: var(--h-radius-md);
	}

	.grid.editing.empty::before {
		content: 'Drop entities here';
		align-self: center;
		justify-self: center;
		color: var(--h-text-6);
		font-size: var(--h-type-secondary);
	}

	.entity-slot {
		position: relative;
		min-width: 0;
	}

	.entity-slot > :global(.tile),
	.entity-slot > :global(.stat) {
		height: 100%;
	}

	/* a style rule's color outlines the tile, whatever state it is in */
	.entity-slot.styled > :global(.tile) {
		border-style: solid;
		border-color: color-mix(in srgb, var(--tile-accent) 45%, transparent);
	}

	/* tiles leave room on the right for the handle while editing */
	.grid.editing :global(.entity-slot) {
		--tile-pad-right: 48px;
	}

	.entity-drag-handle {
		position: absolute;
		top: 50%;
		right: 8px;
		transform: translateY(-50%);
		z-index: var(--h-layer-grid-header);
		display: flex;
		padding: 6px;
		border: 1px solid rgb(var(--h-accent-rgb) / calc(0.35 * var(--h-accent-scale)));
		border-radius: var(--h-radius-tight);
		background: var(--h-sheet-0);
		color: var(--h-text-2);
		cursor: grab;
		touch-action: none;
	}

	/* a finger-sized hit area around the small visible handle */
	@media (pointer: coarse) {
		.entity-drag-handle::before {
			content: '';
			position: absolute;
			top: 50%;
			left: 50%;
			/* capped so a small interface scale cannot spread it over the neighbours */
			width: min(var(--h-touch-target), 56px);
			height: min(var(--h-touch-target), 56px);
			transform: translate(-50%, -50%);
		}
	}

	.entity-slot:global(.sortable-ghost) {
		opacity: 0.35;
	}

	/* see breakpoints.ts */
	@media (max-width: 900px) {
		.grid.fixed {
			grid-template-columns: repeat(var(--folded-columns), minmax(0, 1fr));
		}

		/* one tile per row while editing: the handle column would otherwise
		   truncate every name */
		.grid.editing {
			grid-template-columns: 1fr;
		}

		.grid.editing :global(.entity-slot) {
			--tile-pad-right: 40px;
		}

		.entity-drag-handle {
			right: 6px;
			padding: 4px;
		}
	}
</style>
