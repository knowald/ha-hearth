<script lang="ts" module>
	export interface EditableStat {
		entity: string;
		name: string;
	}
</script>

<script lang="ts">
	import { ICON } from '../iconSizes';
	import { lang } from '$lib/core/i18n';
	import { moveItem } from '../config';
	import Icon from '../Icon.svelte';
	import EntityField from './EntityField.svelte';
	import TextField from './TextField.svelte';

	let { value = $bindable([]) }: { value?: EditableStat[] } = $props();

	function add() {
		value.push({ entity: '', name: '' });
	}
</script>

<!-- the page sheet neither wraps its fields in editor-fields nor gives rows the full width -->
<div class="editor-fields header-stats">
	<div class="group-label">{$lang('hearth_header_readings')}</div>
	{#each value as stat, index (index)}
		<div class="filter-row stat-row">
			<div class="filter-fields stat-fields">
				<EntityField
					label={$lang('entity')}
					bind:value={stat.entity}
					hint={stat.entity.trim() ? undefined : $lang('hearth_empty_row_removed')}
				/>
				<TextField label={$lang('hearth_label_optional')} bind:value={stat.name} />
			</div>
			<div class="entity-row-actions">
				<button
					type="button"
					class="reorder"
					disabled={index === 0}
					aria-label={$lang('hearth_move_reading_up')}
					onclick={() => moveItem(value, index, -1)}
				>
					<Icon name="keyboard_arrow_up" size={ICON.control} />
				</button>
				<button
					type="button"
					class="reorder"
					disabled={index === value.length - 1}
					aria-label={$lang('hearth_move_reading_down')}
					onclick={() => moveItem(value, index, 1)}
				>
					<Icon name="keyboard_arrow_down" size={ICON.control} />
				</button>
				<button
					type="button"
					class="remove"
					aria-label={$lang('hearth_remove_reading')}
					onclick={() => value.splice(index, 1)}
				>
					<Icon name="delete" size={ICON.control} />
				</button>
			</div>
		</div>
	{/each}
	<button type="button" class="add-filter add-reading" onclick={add}>
		<Icon name="add" size={ICON.control} />
		<span>{$lang('hearth_add_reading')}</span>
	</button>
	<div class="field-hint">{$lang('hearth_header_readings_hint')}</div>
</div>

<style>
	.header-stats {
		grid-column: 1 / -1;
	}

	.stat-fields {
		display: grid;
		grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
		column-gap: 12px;
	}

	@media (max-width: 600px) {
		.stat-fields {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	/* level with the inputs, under their labels */
	.stat-row .entity-row-actions {
		margin-top: 24px;
	}

	.stat-row .entity-row-actions .remove {
		margin: 0;
	}

	.add-reading {
		width: 100%;
		background: none;
		font-family: inherit;
	}
</style>
