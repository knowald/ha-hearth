<script lang="ts" module>
	import { colorError } from '../../edit/ColorChips.svelte';
	import { CHART_MAX_ENTITIES, type ChartEntity } from '../../model/cards/chart';

	/** A row as typed; an undefined color is the chart's own pick. */
	export interface EditableChartEntity {
		entity: string;
		name: string;
		color: string | undefined;
	}

	export function editableEntities(entities: ChartEntity[] | undefined): EditableChartEntity[] {
		const rows = (entities ?? []).map((entry) => ({
			entity: entry.entity,
			name: entry.name ?? '',
			color: entry.color
		}));
		// a new chart starts with the row it cannot do without
		return rows.length ? rows : [{ entity: '', name: '', color: undefined }];
	}

	/** The rows with an entity, as the card stores them; undefined when none. */
	export function storedEntities(rows: EditableChartEntity[]): ChartEntity[] | undefined {
		const entities = rows.flatMap((row): ChartEntity[] => {
			const entity = row.entity.trim();
			if (!entity) return [];
			const name = row.name.trim();
			const color = row.color?.trim();
			return [
				{
					entity,
					...(name && { name }),
					...(color && !colorError(color) && { color })
				}
			];
		});
		return entities.length ? entities.slice(0, CHART_MAX_ENTITIES) : undefined;
	}
</script>

<script lang="ts">
	import { tick } from 'svelte';
	import { ICON } from '../../iconSizes';
	import { fill, lang } from '$lib/core/i18n';
	import Icon from '../../Icon.svelte';
	import ColorChips from '../../edit/ColorChips.svelte';
	import EntityField from '../../edit/EntityField.svelte';
	import TextField from '../../edit/TextField.svelte';

	let {
		value = $bindable([]),
		valid = $bindable(true)
	}: { value?: EditableChartEntity[]; valid?: boolean } = $props();

	$effect(() => {
		valid = value.every((row) => !colorError(row.color));
	});

	let root = $state<HTMLElement>();

	function add() {
		if (value.length < CHART_MAX_ENTITIES) value.push({ entity: '', name: '', color: undefined });
	}

	// rows are keyed by index, so the pressed button would become the next
	// row's and a second press would remove that one too
	async function remove(index: number) {
		value.splice(index, 1);
		await tick();
		const next = root?.querySelectorAll<HTMLElement>('.chart-entity-row')[index];
		(
			next?.querySelector('input') ?? root?.querySelector<HTMLElement>('.add-chart-entity')
		)?.focus();
	}
</script>

<div class="editor-fields chart-entities" bind:this={root}>
	<div class="group-label">{$lang('hearth_entities')}</div>
	<div class="field-hint entities-hint">
		{fill($lang('hearth_chart_entities_hint'), { count: CHART_MAX_ENTITIES })}
	</div>
	{#each value as row, index (index)}
		<div
			class="filter-row chart-entity-row"
			role="group"
			aria-label={fill($lang('hearth_chart_entity_number'), { number: index + 1 })}
		>
			<div class="entity-line">
				<div class="entity-fields">
					<EntityField
						label={$lang('entity')}
						required={index === 0}
						bind:value={row.entity}
						hint={index > 0 && !row.entity.trim() ? $lang('hearth_empty_row_removed') : undefined}
					/>
					<TextField label={$lang('hearth_name_optional')} bind:value={row.name} />
				</div>
				{#if value.length > 1}
					<button
						type="button"
						class="remove"
						aria-label={fill($lang('hearth_remove_chart_entity'), { number: index + 1 })}
						onclick={() => remove(index)}
					>
						<Icon name="delete" size={ICON.control} />
					</button>
				{/if}
			</div>
			<ColorChips
				bind:value={row.color}
				automatic
				customLabel={$lang('hearth_segment_custom_color')}
			/>
		</div>
	{/each}
	{#if value.length < CHART_MAX_ENTITIES}
		<button type="button" class="add-filter add-chart-entity" onclick={add}>
			<Icon name="add" size={ICON.control} />
			<span>{$lang('hearth_add_entity')}</span>
		</button>
	{/if}
</div>

<style>
	.chart-entities {
		grid-column: 1 / -1;
	}

	.entities-hint {
		margin-bottom: 10px;
	}

	.chart-entity-row {
		flex-direction: column;
		align-items: stretch;
		gap: 0;
	}

	.entity-line {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
	}

	.entity-fields {
		flex: 1;
		display: grid;
		grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
		column-gap: 12px;
		min-width: 0;
	}

	@media (max-width: 600px) {
		.entity-fields {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	/* level with the inputs, under their labels */
	.entity-line .remove {
		margin-top: 24px;
	}

	.add-chart-entity {
		width: 100%;
		background: none;
		font-family: inherit;
	}
</style>
