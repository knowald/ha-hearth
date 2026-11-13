<script lang="ts" module>
	import { numberFromInput } from '../../edit/numbers';
	import { styleColor } from '../../visibility';
	import type { GaugeSegment } from '../../model/cards/gauge';

	/** A segment as typed: From is text until it parses. */
	export interface EditableSegment {
		from: string;
		color: string;
	}

	// the order of the chips, each with its label
	const ROLE_LABELS = {
		good: 'hearth_good',
		accent: 'hearth_accent',
		bad: 'hearth_bad',
		cool: 'hearth_cool'
	} as const;
	const ROLES = Object.keys(ROLE_LABELS) as (keyof typeof ROLE_LABELS)[];

	function isRole(color: string): boolean {
		return (ROLES as readonly string[]).includes(color.trim().toLowerCase());
	}

	export function segmentFromError(segment: EditableSegment): boolean {
		return !!segment.from.trim() && !Number.isFinite(numberFromInput(segment.from));
	}

	export function segmentColorError(segment: EditableSegment): boolean {
		return !!segment.color.trim() && !styleColor(segment.color);
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

	// a custom row is any color that is not a role, blank included, so the
	// choice lives in the value and survives a removal above it
	function chooseCustom(row: EditableSegment) {
		if (isRole(row.color)) row.color = '';
	}
</script>

<div class="editor-fields gauge-segments" bind:this={root}>
	<div class="group-label">{$lang('hearth_segments')}</div>
	<div class="field-hint segments-hint">{$lang('hearth_segments_hint')}</div>
	{#each value as row, index (index)}
		{@const custom = !isRole(row.color)}
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
			<div class="chips segment-colors" role="group" aria-label={$lang('hearth_color')}>
				{#each ROLES as role (role)}
					<button
						type="button"
						class="chip"
						class:active={row.color.trim().toLowerCase() === role}
						aria-pressed={row.color.trim().toLowerCase() === role}
						onclick={() => (row.color = role)}
					>
						<span class="swatch" style:background={styleColor(role)}></span>
						{$lang(ROLE_LABELS[role])}
					</button>
				{/each}
				<button
					type="button"
					class="chip"
					class:active={custom}
					aria-pressed={custom}
					onclick={() => chooseCustom(row)}
				>
					<span
						class="swatch"
						class:open={!custom || !styleColor(row.color)}
						style:background={custom ? styleColor(row.color) : undefined}
					></span>
					{$lang('hearth_custom')}
				</button>
			</div>
			{#if custom}
				<TextField
					label={$lang('hearth_segment_custom_color')}
					placeholder="#e53935"
					hint={$lang('hearth_style_color_hint')}
					error={segmentColorError(row) ? $lang('hearth_style_color_invalid') : undefined}
					bind:value={row.color}
				/>
			{/if}
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

	.segment-colors {
		margin-top: 0;
	}

	.segment-colors .chip {
		background: none;
		font-family: inherit;
	}

	@media (pointer: coarse) {
		.segment-colors .chip {
			min-height: var(--h-touch-target);
		}
	}

	.swatch {
		width: 12px;
		height: 12px;
		border-radius: var(--h-radius-pill);
		flex: none;
	}

	.swatch.open {
		border: 1px dashed var(--h-text-5);
	}

	.add-segment {
		width: 100%;
		background: none;
		font-family: inherit;
	}
</style>
