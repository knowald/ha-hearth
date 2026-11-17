<script lang="ts" module>
	export interface PlotSeries {
		entity: string;
		name?: string;
		label: string;
		unit: string;
		paint: string;
		faded: boolean;
	}
</script>

<script lang="ts">
	import EmptyState from '../../EmptyState.svelte';
	import { lang, selectedLanguage } from '$lib/core/i18n';
	import { connected } from '$lib/core/ha/connection';
	import {
		cachedData,
		fetchStatistics,
		PERIOD_MS,
		startDataRefresh,
		type StatisticRow
	} from '$lib/core/ha/history';
	import { hearthEditMode } from '../../store';
	import { formatReading, stepDecimals } from '../../format';
	import { chartY, seriesPath } from '../../chartPath';
	import {
		barRects,
		bucketTime,
		chartBucket,
		chartData,
		chartScale,
		chartTypes,
		hasValues,
		linePoints,
		nearestBucket,
		timeFormats,
		timeX,
		type ChartPeriod,
		type ChartStyle
	} from './series';

	let {
		series,
		style,
		period,
		label
	}: { series: PlotSeries[]; style: ChartStyle; period: ChartPeriod; label: string } = $props();

	// what the plot measures before layout, and in tests
	const FALLBACK_WIDTH = 300;
	const FALLBACK_HEIGHT = 160;
	// room above and below the extreme ticks for the stroke and the selection dots
	const PAD = 6;

	let entityKey = $derived(series.map((entry) => entry.entity).join(','));
	let bucket = $derived(chartBucket(style, period));

	let loaded = $state<{ rows: Record<string, StatisticRow[]>; range: [number, number] }>();
	let selected = $state<number | null>(null);

	$effect(() => {
		void entityKey;
		void style;
		void period;
		loaded = undefined;
		selected = null;
	});

	$effect(() => {
		const entityIds = entityKey ? entityKey.split(',') : [];
		if (!entityIds.length || !$connected) return;
		const span = PERIOD_MS[period];
		const statistics = bucket;
		const types = chartTypes(style);
		return startDataRefresh(
			() =>
				cachedData(`chart-card:${style}:${period}:${entityKey}`, async () => {
					const end = Date.now();
					const rows = await fetchStatistics(
						entityIds,
						new Date(end - span),
						new Date(end),
						statistics,
						{ types }
					);
					return { rows, range: [end - span, end] as [number, number] };
				}),
			(value) => (loaded = value)
		);
	});

	let width = $state(0);
	let height = $state(0);
	let box = $derived({
		width: width || FALLBACK_WIDTH,
		height: height || FALLBACK_HEIGHT,
		pad: PAD
	});

	let data = $derived(
		loaded
			? chartData(
					loaded.rows,
					series.map((entry) => entry.entity),
					style
				)
			: null
	);
	let drawable = $derived(data && hasValues(data) ? data : null);
	let scale = $derived(drawable && loaded ? chartScale(drawable, style, loaded.range) : null);

	let lines = $derived(
		drawable && scale && style === 'line'
			? series.map((_, index) => seriesPath(linePoints(drawable, index), box, scale.domain))
			: []
	);
	let bars = $derived(
		drawable && scale && style === 'bar'
			? barRects(drawable, scale.domain, box, loaded?.range[1] ?? Date.now())
			: []
	);

	let current = $derived(
		drawable && selected !== null && selected < drawable.buckets.length ? selected : null
	);
	let shown = $derived(current ?? (drawable ? drawable.buckets.length - 1 : null));

	let formats = $derived(timeFormats(bucket, period));
	function formatTime(time: number, options: Intl.DateTimeFormatOptions): string {
		try {
			return new Intl.DateTimeFormat($selectedLanguage || undefined, options).format(time);
		} catch {
			// a language tag the browser does not know
			return new Intl.DateTimeFormat(undefined, options).format(time);
		}
	}

	let axisTimes = $derived(
		scale
			? [0, 0.5, 1].map((at) => scale.domain.x[0] + at * (scale.domain.x[1] - scale.domain.x[0]))
			: []
	);

	let readout = $derived(
		drawable && shown !== null
			? {
					time: formatTime(drawable.buckets[shown].start, formats.bucket),
					values: series.map((entry, index) => ({
						...entry,
						text: formatReading(drawable.values[index][shown], entry.unit)
					}))
				}
			: null
	);
	let readoutText = $derived(
		readout
			? [readout.time, ...readout.values.map((entry) => `${entry.label} ${entry.text}`)].join(', ')
			: ''
	);

	let interactive = $derived(!$hearthEditMode && !!drawable);

	function bucketAt(event: MouseEvent): number {
		if (!drawable || !scale) return -1;
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const fraction = (event.clientX - rect.left) / (rect.width || 1);
		const [start, end] = scale.domain.x;
		return nearestBucket(drawable, style, start + fraction * (end - start));
	}

	// a tap selects; a drag stays with the page swipe, which eats the click after it
	function pick(event: MouseEvent) {
		if (!interactive) return;
		const index = bucketAt(event);
		if (index >= 0) selected = index;
	}

	function hover(event: PointerEvent) {
		if (!interactive || event.pointerType !== 'mouse') return;
		const index = bucketAt(event);
		if (index >= 0) selected = index;
	}

	function leave(event: PointerEvent) {
		if (event.pointerType === 'mouse') selected = null;
	}

	function step(event: KeyboardEvent) {
		if (!interactive || !drawable) return;
		const last = drawable.buckets.length - 1;
		const from = current ?? last;
		const next =
			event.key === 'ArrowLeft' || event.key === 'ArrowDown'
				? Math.max(0, current === null ? last : from - 1)
				: event.key === 'ArrowRight' || event.key === 'ArrowUp'
					? Math.min(last, current === null ? last : from + 1)
					: event.key === 'Home'
						? 0
						: event.key === 'End'
							? last
							: undefined;
		if (event.key === 'Escape' && current !== null) {
			event.preventDefault();
			selected = null;
		} else if (next !== undefined) {
			event.preventDefault();
			selected = next;
		}
	}

	let selectionX = $derived(
		drawable && scale && current !== null
			? timeX(bucketTime(drawable.buckets[current], style), scale.domain, box)
			: null
	);
</script>

{#if !loaded && !$connected}
	<EmptyState inline text={$lang('hearth_not_connected')} />
{:else if loaded && !drawable}
	<EmptyState inline text={$lang('hearth_no_recorded_history')} />
{:else}
	<div class="chart-body" class:ready={!!drawable}>
		<div class="y-axis" aria-hidden="true">
			{#if scale}
				{#each scale.ticks as tick (tick)}
					<span style:transform="translateY(calc({chartY(tick, box, scale.domain.y)}px - 50%))">
						{formatReading(tick, '', stepDecimals(scale.step))}
					</span>
				{/each}
			{/if}
		</div>
		<div
			class="plot"
			class:selecting={current !== null}
			bind:clientWidth={width}
			bind:clientHeight={height}
			role="slider"
			tabindex={interactive ? 0 : -1}
			aria-disabled={!interactive}
			aria-label={label}
			aria-valuemin={0}
			aria-valuemax={drawable ? drawable.buckets.length - 1 : 0}
			aria-valuenow={shown ?? 0}
			aria-valuetext={readoutText || undefined}
			onclick={pick}
			onpointermove={hover}
			onpointerleave={leave}
			onkeydown={step}
		>
			<svg
				width={box.width}
				height={box.height}
				viewBox="0 0 {box.width} {box.height}"
				aria-hidden="true"
			>
				{#if scale}
					{#each scale.ticks as tick (tick)}
						{@const y = chartY(tick, box, scale.domain.y)}
						<line class="grid" class:zero={tick === 0} x1="0" x2={box.width} y1={y} y2={y} />
					{/each}
					{#if selectionX !== null}
						<line class="cursor" x1={selectionX} x2={selectionX} y1="0" y2={box.height} />
					{/if}
				{/if}
				{#each bars as bar (`${bar.bucket}:${bar.series}`)}
					<rect
						class="bar"
						class:current={bar.current}
						class:faded={series[bar.series]?.faded}
						class:dimmed={current !== null && bar.bucket !== current}
						x={bar.x}
						y={bar.y}
						width={bar.width}
						height={bar.height}
						style:fill={series[bar.series]?.paint}
						style:stroke={series[bar.series]?.paint}
					/>
				{/each}
				{#each lines as path, index (index)}
					<g
						class="series"
						class:faded={series[index]?.faded}
						style:--series={series[index]?.paint}
					>
						<path class="line" d={path.line} />
						{#each path.singles as point, single (single)}
							<circle class="single" cx={point.x} cy={point.y} r="2.5" />
						{/each}
						{#if drawable && scale && current !== null && drawable.values[index][current] !== null}
							<circle
								class="marker"
								cx={selectionX}
								cy={chartY(drawable.values[index][current] ?? 0, box, scale.domain.y)}
								r="4"
							/>
						{/if}
					</g>
				{/each}
			</svg>
		</div>
		<div class="x-axis" aria-hidden="true">
			{#each axisTimes as time, index (index)}
				<span>{formatTime(time, formats.axis)}</span>
			{/each}
		</div>
		<div class="readout" class:idle={current === null} aria-hidden={current === null}>
			{#if readout}
				<span class="readout-time">{readout.time}</span>
				{#each readout.values as entry, index (index)}
					<span class="readout-entry">
						<span class="dot" class:faded={entry.faded} style:background={entry.paint}></span>
						<span class="readout-name">{entry.label}</span>
						<span class="readout-value">{entry.text}</span>
					</span>
				{/each}
			{:else}
				<!-- keeps the row's height while the data loads -->
				<span class="readout-time">&nbsp;</span>
			{/if}
		</div>
	</div>
{/if}

<style>
	.chart-body {
		display: grid;
		flex: 1;
		grid-template-columns: auto minmax(0, 1fr);
		grid-template-rows: minmax(0, 1fr) auto auto;
		column-gap: 8px;
		row-gap: 6px;
		min-height: 0;
	}

	.y-axis {
		display: grid;
		align-items: start;
		justify-items: end;
		font-family: var(--h-font-mono);
		font-size: var(--h-type-small);
		color: var(--h-text-5);
		line-height: 1;
	}

	/* stacked in one cell, so the column is as wide as the widest label */
	.y-axis span {
		grid-area: 1 / 1;
		white-space: nowrap;
	}

	.plot {
		position: relative;
		min-width: 0;
		min-height: 100px;
		outline-offset: 4px;
	}

	.plot[aria-disabled='false'] {
		cursor: crosshair;
	}

	svg {
		position: absolute;
		inset: 0;
		display: block;
		overflow: visible;
		opacity: 0;
		transition: opacity var(--h-motion-base) var(--h-ease);
	}

	.ready svg {
		opacity: 1;
	}

	.grid {
		stroke: rgb(var(--h-line-rgb) / calc(0.08 * var(--h-line-scale)));
		stroke-width: 1;
	}

	.grid.zero {
		stroke: rgb(var(--h-line-rgb) / calc(0.2 * var(--h-line-scale)));
	}

	.cursor {
		stroke: rgb(var(--h-line-rgb) / calc(0.3 * var(--h-line-scale)));
		stroke-width: 1;
	}

	.line {
		fill: none;
		stroke: var(--series);
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
	}

	.single {
		fill: var(--series);
	}

	.marker {
		fill: var(--series);
		stroke: var(--h-sheet-1);
		stroke-width: 2;
	}

	.faded {
		opacity: 0.5;
	}

	.bar {
		stroke-width: 0;
		transition: opacity var(--h-motion-fast) var(--h-ease);
	}

	/* the running bucket's bar is not final yet */
	.bar.current {
		fill-opacity: 0.3;
		stroke-width: 1;
		stroke-dasharray: 3 2;
	}

	.bar.dimmed {
		opacity: 0.45;
	}

	.bar.faded.dimmed {
		opacity: 0.25;
	}

	.x-axis {
		grid-column: 2;
		display: flex;
		justify-content: space-between;
		gap: 8px;
		font-family: var(--h-font-mono);
		font-size: var(--h-type-small);
		color: var(--h-text-5);
		white-space: nowrap;
	}

	.readout {
		grid-column: 1 / -1;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		column-gap: 14px;
		row-gap: 4px;
		font-size: var(--h-type-secondary);
		color: var(--h-text-4);
		transition: opacity var(--h-motion-fast) var(--h-ease);
	}

	.readout.idle {
		opacity: 0;
	}

	.readout-time {
		font-family: var(--h-font-mono);
		color: var(--h-text-5);
	}

	.readout-entry {
		display: inline-flex;
		align-items: baseline;
		gap: 6px;
		min-width: 0;
	}

	.readout-value {
		font-family: var(--h-font-mono);
		color: var(--h-text-1);
	}

	.dot {
		flex: none;
		align-self: center;
		width: 8px;
		height: 8px;
		border-radius: var(--h-radius-pill);
	}
</style>
