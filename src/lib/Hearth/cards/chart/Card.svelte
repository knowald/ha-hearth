<script lang="ts" module>
	import { styleColor } from '../../visibility';
	import type { ChartEntity } from '../../model/cards/chart';

	// a series without a color of its own takes the next role; past the four
	// roles the order repeats, faded, so a fifth line is still told apart
	const SERIES_ROLES = ['accent', 'cool', 'good', 'bad'];

	export function seriesPaint(
		entry: ChartEntity,
		index: number
	): { paint: string; faded: boolean } {
		const own = styleColor(entry.color);
		if (own) return { paint: own, faded: false };
		return {
			paint: styleColor(SERIES_ROLES[index % SERIES_ROLES.length]) ?? '',
			faded: index >= SERIES_ROLES.length
		};
	}
</script>

<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import { entityAvailability, sensorNumber, states } from '$lib/core/ha/entities';
	import { hearthEditMode } from '../../store';
	import { formatReading } from '../../format';
	import { openEntityDetail } from '../../details';
	import type { ChartCard } from '../../model/cards/chart';
	import type { PlotSeries } from './Plot.svelte';

	let { card }: { card: ChartCard } = $props();

	const PERIOD_LABELS = {
		day: 'hearth_last_day',
		week: 'hearth_last_week',
		month: 'hearth_last_month'
	} as const;

	let style = $derived(card.style ?? 'line');
	let period = $derived(card.period ?? 'day');

	let series = $derived(
		(card.entities ?? []).map((entry, index): PlotSeries & { state: string; openable: boolean } => {
			const stateObj = $states?.[entry.entity];
			const availability = entityAvailability(stateObj);
			const unit = stateObj?.attributes?.unit_of_measurement ?? '';
			return {
				entity: entry.entity,
				name: entry.name,
				label: entry.name || stateObj?.attributes?.friendly_name || entry.entity,
				unit,
				...seriesPaint(entry, index),
				state:
					availability === 'missing'
						? $lang('hearth_missing_entity')
						: availability !== 'available'
							? $lang(availability)
							: formatReading(sensorNumber(stateObj?.state), unit),
				openable: !!stateObj && !$hearthEditMode
			};
		})
	);

	let title = $derived(card.name || (series.length === 1 ? series[0].label : ''));
</script>

{#snippet chip(entry: (typeof series)[number])}
	<span class="dot" style:background={entry.paint} class:faded={entry.faded}></span>
	<span class="chip-name">{entry.label}</span>
	<span class="chip-value">{entry.state}</span>
{/snippet}

<div
	class="card chart"
	class:bars={style === 'bar'}
	data-style={style}
	style:height={card.height ? `${card.height}px` : undefined}
>
	<div class="head">
		{#if title}<div class="name">{title}</div>{/if}
		<div class="period">{$lang(PERIOD_LABELS[period])}</div>
	</div>
	<div class="legend">
		{#each series as entry, index (index)}
			{#if entry.openable}
				<button
					type="button"
					class="chip"
					data-entity={entry.entity}
					onclick={() => openEntityDetail(entry.entity, entry.name)}
				>
					{@render chip(entry)}
				</button>
			{:else}
				<span class="chip" data-entity={entry.entity}>{@render chip(entry)}</span>
			{/if}
		{/each}
	</div>
	<div class="plot-area">
		<!-- the plot and its data code load on their own, after the dashboard's first frame -->
		{#await import('./Plot.svelte') then Plot}
			<Plot.default {series} {style} {period} label={title || $lang('hearth_card_chart_name')} />
		{/await}
	</div>
</div>

<style>
	.card {
		display: flex;
		flex-direction: column;
		gap: 12px;
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		padding: var(--h-card-padding);
		border-radius: var(--h-radius-card);
		background: rgb(var(--h-surface-rgb) / calc(0.045 * var(--h-fill-scale)));
		backdrop-filter: var(--h-surface-blur);
		box-shadow: var(--h-card-shadow);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.06 * var(--h-line-scale)));
		user-select: none;
		-webkit-user-select: none;
		overflow: hidden;
	}

	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		min-width: 0;
	}

	.name {
		font-size: var(--h-type-body);
		color: var(--h-text-4);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.period {
		margin-left: auto;
		flex: none;
		font-size: var(--h-type-secondary);
		color: var(--h-text-5);
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.chip {
		display: flex;
		align-items: center;
		gap: 8px;
		box-sizing: border-box;
		min-width: 0;
		max-width: 100%;
		min-height: var(--h-touch-target);
		margin: 0;
		padding: 0 14px;
		border: 0;
		border-radius: var(--h-radius-pill);
		background: rgb(var(--h-surface-rgb) / calc(0.06 * var(--h-fill-scale)));
		font: inherit;
		font-size: var(--h-type-secondary);
		color: var(--h-text-4);
		appearance: none;
	}

	button.chip {
		cursor: pointer;
	}

	.dot {
		flex: none;
		width: 10px;
		height: 10px;
		border-radius: var(--h-radius-pill);
	}

	.bars .dot {
		border-radius: var(--h-radius-hair);
	}

	.dot.faded {
		opacity: 0.5;
	}

	.chip-name {
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.chip-value {
		flex: none;
		font-family: var(--h-font-mono);
		color: var(--h-text-1);
	}

	/* holds the plot's height while it loads, so nothing below it moves */
	.plot-area {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 180px;
	}
</style>
