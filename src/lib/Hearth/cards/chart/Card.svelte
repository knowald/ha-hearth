<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import { entityAvailability, sensorNumber, states } from '$lib/core/ha/entities';
	import { hearthEditMode } from '../../store';
	import { formatReading } from '../../format';
	import { openEntityDetail } from '../../details';
	import type { ChartCard } from '../../model/cards/chart';
	import type { PlotReading, PlotSeries } from './Plot.svelte';
	import { loadPlot } from './loadPlot';
	import { seriesPaint } from './paint';

	let { card }: { card: ChartCard } = $props();

	// the space between chips, in the legend's own style too
	const LEGEND_GAP = 6;

	const PERIOD_LABELS = {
		day: 'hearth_last_day',
		week: 'hearth_last_week',
		month: 'hearth_last_month'
	} as const;

	let style = $derived(card.style ?? 'line');
	let period = $derived(card.period ?? 'day');
	let periodText = $derived($lang(PERIOD_LABELS[period]));

	let plot = $state(loadPlot());
	let reading = $state<PlotReading>();

	let series = $derived(
		(card.entities ?? []).map((entry, index) => {
			const stateObj = $states?.[entry.entity];
			return {
				entity: entry.entity,
				name: entry.name,
				label: entry.name || stateObj?.attributes?.friendly_name || entry.entity,
				unit: stateObj?.attributes?.unit_of_measurement ?? '',
				...seriesPaint(entry.color, index),
				stateObj,
				openable: !!stateObj && !$hearthEditMode
			};
		})
	);
	let plotSeries = $derived(
		series.map(({ entity, label, unit, paint, faded }): PlotSeries => ({
			entity,
			label,
			unit,
			paint,
			faded
		}))
	);

	/*
	 * A selected time shows its values in the chips. Otherwise a line chip
	 * shows the live reading, and a bar chip the newest bar, since a meter's
	 * total says nothing about what one bar counts.
	 */
	function chipText(entry: (typeof series)[number], index: number): string {
		if (reading?.selected) return formatReading(reading.values[index], entry.unit);
		const availability = entityAvailability(entry.stateObj);
		if (availability === 'missing') return $lang('hearth_missing_entity');
		if (availability !== 'available') return $lang(availability);
		if (style === 'bar') return formatReading(reading?.values[index], entry.unit);
		return formatReading(sensorNumber(entry.stateObj?.state), entry.unit);
	}

	let title = $derived(card.name || (series.length === 1 ? series[0].label : ''));

	let frame = $state<HTMLElement>();
	let frameHeight = $state(0);

	/*
	 * The legend shows two rows of chips when the plot keeps its floor below
	 * them, else one, and scrolls the rest. Whole rows, so no chip is cut in
	 * half; measured, since touch chips are taller and the card's height
	 * comes from its column.
	 */
	let legendRows = $derived.by(() => {
		if (!frame || !frameHeight) return 2;
		const chip = frame.querySelector<HTMLElement>('.chip');
		const head = frame.querySelector<HTMLElement>('.head');
		const area = frame.querySelector<HTMLElement>('.plot-area');
		if (!chip || !area) return 2;
		const box = getComputedStyle(frame);
		const gap = parseFloat(box.rowGap) || 0;
		const free =
			frameHeight -
			parseFloat(box.paddingTop) -
			parseFloat(box.paddingBottom) -
			(head?.offsetHeight ?? 0) -
			parseFloat(getComputedStyle(area).minHeight) -
			2 * gap;
		// a pixel of slack for rounding, so a card sized by its content keeps two rows
		return free + 1 >= 2 * chip.offsetHeight + LEGEND_GAP ? 2 : 1;
	});
</script>

{#snippet chip(entry: (typeof series)[number], index: number)}
	<span class="dot" style:background={entry.paint} class:faded={entry.faded}></span>
	<span class="chip-name">{entry.label}</span>
	<span class="chip-value">{chipText(entry, index)}</span>
{/snippet}

<div
	class="card chart"
	class:bars={style === 'bar'}
	data-style={style}
	style:height={card.height ? `${card.height}px` : undefined}
	bind:this={frame}
	bind:clientHeight={frameHeight}
>
	<div class="head">
		{#if title}<div class="name">{title}</div>{/if}
		<div class="period">{periodText}</div>
	</div>
	<div
		class="legend"
		class:selected={reading?.selected}
		style:--chart-legend-rows={legendRows}
		style:--chart-legend-gap="{LEGEND_GAP}px"
	>
		{#each series as entry, index (index)}
			{#if entry.openable}
				<button
					type="button"
					class="chip"
					data-entity={entry.entity}
					onclick={() => openEntityDetail(entry.entity, entry.name)}
				>
					{@render chip(entry, index)}
				</button>
			{:else}
				<span class="chip" data-entity={entry.entity}>{@render chip(entry, index)}</span>
			{/if}
		{/each}
	</div>
	<div class="plot-area">
		{#await plot then Plot}
			<Plot.default
				series={plotSeries}
				{style}
				{period}
				label={title || $lang('hearth_card_chart_name')}
				idleText={periodText}
				bind:reading
			/>
		{:catch}
			<!-- offline or a stale deploy: the card stays, and a tap asks again -->
			<div class="load-error" role="alert">
				<span>{$lang('hearth_could_not_load_component')}</span>
				<button type="button" class="retry" onclick={() => (plot = loadPlot())}>
					{$lang('hearth_retry')}
				</button>
			</div>
		{/await}
	</div>
</div>

<style>
	.card {
		/* the plot's own floor; the legend gives way before it does */
		--chart-plot-floor: 96px;
		--chart-chip-height: 32px;
		display: flex;
		flex-direction: column;
		gap: 10px;
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

	@media (pointer: coarse) {
		.card {
			--chart-chip-height: var(--h-touch-target);
		}
	}

	.head {
		display: flex;
		flex: none;
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

	/* whole rows of chips, as many as legendRows allows; past that the chips scroll */
	.legend {
		display: flex;
		flex: none;
		flex-wrap: wrap;
		align-content: flex-start;
		gap: var(--chart-legend-gap);
		max-height: calc(
			var(--chart-legend-rows) * var(--chart-chip-height) + (var(--chart-legend-rows) - 1) *
				var(--chart-legend-gap)
		);
		overflow-x: hidden;
		overflow-y: auto;
		scroll-snap-type: y mandatory;
		scrollbar-width: thin;
	}

	.chip {
		display: flex;
		flex: none;
		scroll-snap-align: start;
		align-items: center;
		gap: 8px;
		box-sizing: border-box;
		min-width: 0;
		max-width: 100%;
		height: var(--chart-chip-height);
		margin: 0;
		padding: 0 12px;
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
		max-width: 10em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.chip-value {
		flex: none;
		font-family: var(--h-font-mono);
		color: var(--h-text-1);
	}

	.legend.selected .chip-value {
		color: var(--h-accent-text);
	}

	/* holds the plot's height while it loads, so nothing below it moves */
	.plot-area {
		display: flex;
		flex: 1 0 auto;
		flex-direction: column;
		min-height: calc(var(--chart-plot-floor) + 48px);
	}

	.load-error {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		margin: auto 0;
		font-size: var(--h-type-secondary);
		color: var(--h-text-5);
	}

	.retry {
		min-height: var(--h-touch-target);
		padding: 0 16px;
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.08 * var(--h-line-scale)));
		border-radius: var(--h-radius-pill);
		background: rgb(var(--h-surface-rgb) / calc(0.06 * var(--h-fill-scale)));
		font: inherit;
		color: var(--h-text-3);
		cursor: pointer;
	}
</style>
