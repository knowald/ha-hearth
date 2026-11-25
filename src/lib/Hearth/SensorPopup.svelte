<script lang="ts">
	import EmptyState from './EmptyState.svelte';
	import { lang } from '$lib/core/i18n';
	import { connected } from '$lib/core/ha/connection';
	import { states } from '$lib/core/ha/entities';
	import { cachedData, fetchStatisticSeries, startDataRefresh } from '$lib/core/ha/history';
	import { sensorNumber } from '$lib/core/ha/entities';
	import { formatReading } from './format';
	import { seriesPath } from './chartPath';

	let { entity }: { entity: string } = $props();

	let stateObj = $derived($states?.[entity]);
	let value = $derived(sensorNumber(stateObj?.state));
	let unit = $derived(stateObj?.attributes?.unit_of_measurement ?? '');

	let history = $state<number[] | null>(null);

	$effect(() => {
		void entity;
		history = null;
	});

	// same 24h hourly means the temperature card charts, shared through the
	// recorder cache so opening the popup after the card costs nothing
	$effect(() => {
		if (!$connected) return;

		return startDataRefresh(
			() =>
				cachedData(`temperature-history:${entity}`, () =>
					fetchStatisticSeries(entity, new Date(Date.now() - 24 * 3600 * 1000), new Date(), 'hour')
				),
			(values) => (history = values)
		);
	});

	const CHART_WIDTH = 520;
	const CHART_HEIGHT = 110;

	let chart = $derived.by(() => {
		if (!history) return null;
		const values = history;
		const low = Math.min(...values);
		const high = Math.max(...values);
		const path = seriesPath(
			values.map((entry, index) => ({ x: index, y: entry })),
			{ width: CHART_WIDTH, height: CHART_HEIGHT, pad: 10 },
			{ x: [0, values.length - 1], y: [low, high] }
		);
		return { ...path, low, high, end: path.coords[path.coords.length - 1] };
	});
</script>

<div class="reading">
	<span class="value">{formatReading(value)}</span>
	<span class="unit">{unit}</span>
</div>

{#if chart}
	<svg viewBox="0 0 {CHART_WIDTH} {CHART_HEIGHT}" preserveAspectRatio="none">
		<defs>
			<linearGradient id="sensor-popup-gradient" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stop-color="var(--h-accent-dim-text)" stop-opacity="0.25" />
				<stop offset="1" stop-color="var(--h-accent-dim-text)" stop-opacity="0" />
			</linearGradient>
		</defs>
		<path d={chart.area} fill="url(#sensor-popup-gradient)" />
		<path
			d={chart.line}
			fill="none"
			stroke="var(--h-accent-dim-text)"
			stroke-width="2"
			stroke-linejoin="round"
		/>
		<circle cx={chart.end.x} cy={chart.end.y} r="4" fill="rgb(var(--h-accent-rgb))" />
	</svg>
	<div class="chart-footer">
		<span>24 H</span>
		<span
			>{$lang('hearth_low')}
			{formatReading(chart.low)} · {$lang('hearth_high')}
			{formatReading(chart.high)}</span
		>
	</div>
{:else}
	<EmptyState icon="show_chart" text={$lang('hearth_no_recorded_history_for_the_last')} />
{/if}

<style>
	.reading {
		display: flex;
		align-items: baseline;
		gap: 10px;
		margin-top: 22px;
	}

	.value {
		font-size: var(--h-type-hero);
		font-weight: 600;
		letter-spacing: -1.5px;
		color: var(--h-text-1);
	}

	.unit {
		font-size: var(--h-type-subtitle);
		color: var(--h-text-3);
	}

	svg {
		width: 100%;
		height: 104px;
		display: block;
		margin-top: 14px;
	}

	.chart-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 8px;
		font-family: var(--h-font-mono);
		font-size: var(--h-type-caption);
		letter-spacing: 1.4px;
		text-transform: uppercase;
		color: var(--h-text-6);
	}
</style>
