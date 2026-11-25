<script lang="ts" module>
	import { numberFromInput } from '../../edit/numbers';
	import { styleColor } from '../../visibility';
	import { colorError } from '../../edit/ColorChips.svelte';
	import type { GaugeSegment } from '../../model/cards/gauge';

	/** A segment as typed: From is text until it parses. */
	export interface EditableSegment {
		from: string;
		color: string;
	}

	export function segmentFromError(segment: EditableSegment): boolean {
		return !!segment.from.trim() && !Number.isFinite(numberFromInput(segment.from));
	}

	export function segmentColorError(segment: EditableSegment): boolean {
		return colorError(segment.color);
	}

	/** Whether the row is left out on save rather than blocking it. */
	export function segmentUnfinished(segment: EditableSegment): boolean {
		return !segment.from.trim() || !segment.color.trim();
	}

	/** The finished rows as the card stores them, the color as typed; undefined when none. */
	export function storedSegments(rows: EditableSegment[]): GaugeSegment[] | undefined {
		const segments = rows.flatMap((row): GaugeSegment[] => {
			const from = numberFromInput(row.from);
			const color = row.color.trim();
			return Number.isFinite(from) && color && styleColor(color) ? [{ from, color }] : [];
		});
		return segments.length ? segments : undefined;
	}
</script>

<script lang="ts">
	import { tick } from 'svelte';
	import { ICON } from '../../iconSizes';
	import { fill, lang } from '$lib/core/i18n';
	import Icon from '../../Icon.svelte';
	import TextField from '../../edit/TextField.svelte';
	import ColorChips from '../../edit/ColorChips.svelte';

	let {
		value = $bindable([]),
		valid = $bindable(true)
	}: { value?: EditableSegment[]; valid?: boolean } = $props();

	$effect(() => {
		valid = value.every((row) => !segmentFromError(row) && !segmentColorError(row));
	});

	let root = $state<HTMLElement>();

	function add() {
		value.push({ from: '', color: 'accent' });
	}

	// rows are keyed by index, so the pressed button would become the next
	// row's and a second press would remove that one too
	async function remove(index: number) {
		value.splice(index, 1);
		await tick();
		const next = root?.querySelectorAll<HTMLElement>('.segment-row')[index];
		(next?.querySelector('input') ?? root?.querySelector<HTMLElement>('.add-segment'))?.focus();
	}
</script>

<div class="editor-fields gauge-segments" bind:this={root}>
	<div class="group-label">{$lang('hearth_segments')}</div>
	<div class="field-hint segments-hint">{$lang('hearth_segments_hint')}</div>
	{#each value as row, index (index)}
		<div
			class="filter-row segment-row"
			role="group"
			aria-label={fill($lang('hearth_segment_number'), { number: index + 1 })}
		>
			<div class="segment-line">
				<div class="segment-from">
					<TextField
						label={$lang('hearth_segment_from')}
						inputmode="decimal"
						bind:value={row.from}
						error={segmentFromError(row) ? $lang('hearth_segment_from_invalid') : undefined}
						hint={segmentUnfinished(row) ? $lang('hearth_segment_unfinished_removed') : undefined}
					/>
				</div>
				<button
					type="button"
					class="remove"
					aria-label={fill($lang('hearth_remove_segment'), { number: index + 1 })}
					onclick={() => remove(index)}
				>
					<Icon name="delete" size={ICON.control} />
				</button>
			</div>
			<ColorChips bind:value={row.color} customLabel={$lang('hearth_segment_custom_color')} />
		</div>
	{/each}
	<button type="button" class="add-filter add-segment" onclick={add}>
		<Icon name="add" size={ICON.control} />
		<span>{$lang('hearth_add_segment')}</span>
	</button>
</div>

<style>
	.gauge-segments {
		grid-column: 1 / -1;
	}

	.segments-hint {
		margin-bottom: 10px;
	}

	.segment-row {
		flex-direction: column;
		align-items: stretch;
		gap: 0;
	}

	.segment-line {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
	}

	.segment-from {
		flex: 1;
		max-width: 320px;
		min-width: 0;
	}

	.add-segment {
		width: 100%;
		background: none;
		font-family: inherit;
	}
</style>
