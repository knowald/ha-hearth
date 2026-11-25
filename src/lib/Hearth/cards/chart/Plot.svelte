<script lang="ts" module>
	export interface PlotSeries {
		entity: string;
		label: string;
		unit: string;
		paint: string;
		faded: boolean;
	}

	/** What the legend shows from the plot: the selected bucket's values, or each series' newest. */
	export interface PlotReading {
		values: (number | null)[];
		selected: boolean;
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
	import { displayTimeZone, hearthEditMode, railClock } from '../../store';
	import { formatReading } from '../../format';
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
		tickLabel,
		timeX,
		type ChartPeriod,
		type ChartStyle
	} from './series';
	import { axisTicks, chartStart, formatTime, timeFormats } from './time';
	import { TYPE_SCALE } from '$lib/core/theme';

	let {
		series,
		style,
		period,
		label,
		idleText,
		reading = $bindable()
	}: {
		series: PlotSeries[];
		style: ChartStyle;
		period: ChartPeriod;
		label: string;
		/** What the slider says while no time is selected. */
		idleText: string;
		reading?: PlotReading;
	} = $props();

	// what the plot measures before layout, and in tests
	const FALLBACK_WIDTH = 300;
	const FALLBACK_HEIGHT = 120;
	// room above and below the extreme ticks for the stroke and the selection dots
	const PAD = 6;
	// a mono digit is about 0.6em wide; labels are set in the small type size
	const LABEL_CHAR = 0.6 * TYPE_SCALE.small;
	const LABEL_SPACE = 12;

	let entityKey = $derived(series.map((entry) => entry.entity).join(','));
	let bucket = $derived(chartBucket(style, period));
	let timeZone = $derived($displayTimeZone);

	let loaded = $state<{ rows: Record<string, StatisticRow[]>; range: [number, number] }>();
	// the selected bucket's start, so a refresh that adds a bucket keeps the same time selected
	let selectedStart = $state<number | null>(null);
	// a click, tap or key pins the selection; a mouse only hovering does not
	let pinned = $state(false);

	function clearSelection() {
		selectedStart = null;
		pinned = false;
	}

	$effect(() => {
		void entityKey;
		void style;
		void period;
		void timeZone;
		loaded = undefined;
		clearSelection();
	});

	$effect(() => {
		const entityIds = entityKey ? entityKey.split(',') : [];
		if (!entityIds.length || !$connected) return;
		const span = PERIOD_MS[period];
		const statistics = bucket;
		const types = chartTypes(style);
		const zone = timeZone;
		return startDataRefresh(
			() =>
				cachedData(`chart-card:${style}:${period}:${zone ?? ''}:${entityKey}`, async () => {
					const end = Date.now();
					const start = chartStart(end, span, statistics, zone);
					const rows = await fetchStatistics(
						entityIds,
						new Date(start),
						new Date(end),
						statistics,
						{ types }
					);
					return { rows, range: [start, end] as [number, number] };
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

	let current = $derived.by(() => {
		if (!drawable || selectedStart === null) return null;
		const index = drawable.buckets.findIndex((entry) => entry.start === selectedStart);
		return index < 0 ? null : index;
	});

	$effect(() => {
		// a refresh dropped the selected bucket; a pin left behind would shut hover out
		if (drawable && selectedStart !== null && current === null) {
			selectedStart = null;
			pinned = false;
		}
	});

	$effect(() => {
		if (!data) {
			reading = undefined;
			return;
		}
		const chart = data;
		reading =
			current !== null
				? { values: chart.values.map((values) => values[current]), selected: true }
				: {
						values: chart.values.map(
							(values) => values.findLast((value) => value !== null) ?? null
						),
						selected: false
					};
	});

	let formats = $derived(timeFormats(bucket, period, timeZone, $railClock?.hour_format));

	let axisLabels = $derived.by(() => {
		if (!scale || !loaded) return [];
		const scaled = scale;
		const end = loaded.range[1];
		const label = (time: number) => formatTime(time, $selectedLanguage, formats.axis);
		// the room a label takes, from its text, so a 12-hour clock spaces wider
		const widthOf = (text: string) => text.length * LABEL_CHAR;
		let ticks = axisTicks(period, style, scaled.domain.x, end, timeZone);
		let texts = ticks.map((tick) => label(tick.time));
		const widest = Math.max(0, ...texts.map(widthOf));
		if (period === 'week' && box.width / 7 < widest + LABEL_SPACE) {
			ticks = axisTicks(period, style, scaled.domain.x, end, timeZone, true);
			texts = ticks.map((tick) => label(tick.time));
		}
		const placed: { text: string; x: number; align: string; left: number }[] = [];
		// newest first, so the label closest to now is the one kept
		for (let index = ticks.length - 1; index >= 0; index -= 1) {
			const x = timeX(ticks[index].at, scaled.domain, box);
			const width = widthOf(texts[index]);
			// a label that would leave the plot turns inward at that edge
			const align = x - width / 2 < 0 ? 'start' : x + width / 2 > box.width ? 'end' : 'middle';
			const left = align === 'start' ? x : align === 'end' ? x - width : x - width / 2;
			const next = placed[placed.length - 1];
			if (next && left + width + LABEL_SPACE > next.left) continue;
			placed.push({ text: texts[index], x, align, left });
		}
		return placed.reverse();
	});

	let selectedTime = $derived(
		drawable && current !== null
			? formatTime(drawable.buckets[current].start, $selectedLanguage, formats.bucket)
			: ''
	);
	let valueText = $derived(
		drawable && current !== null
			? [
					selectedTime,
					...series.map(
						(entry, index) =>
							`${entry.label} ${formatReading(drawable.values[index][current], entry.unit)}`
					)
				].join(', ')
			: idleText
	);

	let interactive = $derived(!$hearthEditMode && !!drawable);

	function bucketAt(event: MouseEvent): number {
		if (!drawable || !scale) return -1;
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const fraction = (event.clientX - rect.left) / (rect.width || 1);
		const [start, end] = scale.domain.x;
		return nearestBucket(drawable, style, start + fraction * (end - start));
	}

	function select(index: number) {
		if (drawable && index >= 0) selectedStart = drawable.buckets[index].start;
	}

	// a tap selects; a drag stays with the page swipe, which eats the click after it
	function pick(event: MouseEvent) {
		if (!interactive) return;
		select(bucketAt(event));
		pinned = selectedStart !== null;
	}

	function hover(event: PointerEvent) {
		if (!interactive || pinned || event.pointerType !== 'mouse') return;
		select(bucketAt(event));
	}

	function leave(event: PointerEvent) {
		if (event.pointerType === 'mouse' && !pinned) selectedStart = null;
	}

	function step(event: KeyboardEvent) {
		if (!interactive || !drawable) return;
		const last = drawable.buckets.length - 1;
		if (event.key === 'Escape') {
			if (current === null) return;
			event.preventDefault();
			clearSelection();
			return;
		}
		// the first arrow selects the newest bucket, so the change is announced
		const next =
			current === null && /^Arrow/.test(event.key)
				? last
				: event.key === 'ArrowLeft' || event.key === 'ArrowDown'
					? Math.max(0, (current ?? last) - 1)
					: event.key === 'ArrowRight' || event.key === 'ArrowUp'
						? Math.min(last, (current ?? last) + 1)
						: event.key === 'Home'
							? 0
							: event.key === 'End'
								? last
								: undefined;
		if (next === undefined) return;
		event.preventDefault();
		select(next);
		pinned = true;
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
						{tickLabel(tick, scale.step)}
					</span>
				{/each}
			{/if}
		</div>
		<div
			class="plot"
			bind:clientWidth={width}
			bind:clientHeight={height}
			role="slider"
			tabindex={interactive ? 0 : -1}
			aria-disabled={!interactive}
			aria-label={label}
			aria-valuemin={0}
			aria-valuemax={drawable ? drawable.buckets.length - 1 : 0}
			aria-valuenow={current ?? (drawable ? drawable.buckets.length - 1 : 0)}
			aria-valuetext={valueText}
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
			<!-- one line's height while the labels sit absolutely -->
			<span class="strut">&nbsp;</span>
			{#each axisLabels as entry (entry.x)}
				<span class="tick {entry.align}" style:left="{entry.x}px">{entry.text}</span>
			{/each}
		</div>
		<!-- one line, always there, so selecting moves nothing; the slider announces the values -->
		<div class="readout" class:idle={current === null} aria-hidden="true">
			{#if selectedTime}{selectedTime}{:else}&nbsp;{/if}
		</div>
	</div>
{/if}

<style>
	.chart-body {
		display: grid;
		flex: 1;
		grid-template-columns: auto minmax(0, 1fr);
		grid-template-rows: minmax(var(--chart-plot-floor), 1fr) auto auto;
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
		min-height: var(--chart-plot-floor);
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
		position: relative;
		font-family: var(--h-font-mono);
		font-size: var(--h-type-small);
		color: var(--h-text-5);
		white-space: nowrap;
	}

	.strut {
		visibility: hidden;
	}

	.tick {
		position: absolute;
		top: 0;
		transform: translateX(-50%);
	}

	.tick.start {
		transform: none;
	}

	.tick.end {
		transform: translateX(-100%);
	}

	.readout {
		grid-column: 2;
		font-family: var(--h-font-mono);
		font-size: var(--h-type-secondary);
		color: var(--h-text-4);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		transition: opacity var(--h-motion-fast) var(--h-ease);
	}

	.readout.idle {
		opacity: 0;
	}
</style>
