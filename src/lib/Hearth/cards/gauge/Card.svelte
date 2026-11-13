<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import { entityAvailability, sensorNumber, states } from '$lib/core/ha/entities';
	import { hearthEditMode } from '../../store';
	import { formatReading } from '../../format';
	import { openEntityDetail } from '../../details';
	import { styleColor } from '../../visibility';
	import {
		GAUGE_MAX,
		GAUGE_MIN,
		gaugeBands,
		gaugeFraction,
		gaugeSegment,
		type GaugeCard
	} from '../../model/cards/gauge';

	let { card }: { card: GaugeCard } = $props();

	// the half arc's center and radii in the 200 x 112 view box
	const CX = 100;
	const CY = 104;
	const RADIUS = 76;
	const BAND_RADIUS = 90;
	const NEEDLE_LENGTH = 62;
	// the cut between two outer band segments, as a fraction of the range
	const BAND_GAP = 0.012;
	const ACCENT = 'rgb(var(--h-accent-rgb))';

	let entity = $derived(card.entity ?? '');
	let stateObj = $derived(entity ? $states?.[entity] : undefined);
	let availability = $derived(entityAvailability(stateObj));
	let label = $derived(card.name || stateObj?.attributes?.friendly_name || entity);
	let unit = $derived(card.unit ?? stateObj?.attributes?.unit_of_measurement ?? '');
	let value = $derived(sensorNumber(stateObj?.state));
	let min = $derived(card.min ?? GAUGE_MIN);
	let max = $derived(card.max ?? GAUGE_MAX);
	let fraction = $derived(gaugeFraction(value, min, max));

	let segments = $derived(
		(card.segments ?? []).map((segment) => ({
			...segment,
			// a color styleColor cannot read keeps the segment's start but draws in the accent
			paint: styleColor(segment.color) ?? ACCENT
		}))
	);
	let current = $derived(gaugeSegment(segments, value));
	let bands = $derived(gaugeBands(segments, min, max));

	let stateText = $derived(
		availability === 'missing'
			? $lang('hearth_missing_entity')
			: availability !== 'available'
				? $lang(availability)
				: (stateObj?.state ?? '')
	);

	// percent and degrees bind to the number, as formatReading writes them
	let tightUnit = $derived(unit === '%' || unit.startsWith('\u00b0'));

	let openable = $derived(!$hearthEditMode && value !== null);

	function tap() {
		if (!$hearthEditMode && value !== null) openEntityDetail(entity, card.name);
	}

	function point(radius: number, at: number): string {
		const angle = Math.PI * (1 - at);
		return `${(CX + radius * Math.cos(angle)).toFixed(2)} ${(CY - radius * Math.sin(angle)).toFixed(2)}`;
	}

	function arc(radius: number, start: number, end: number): string {
		return `M${point(radius, start)} A${radius} ${radius} 0 0 1 ${point(radius, end)}`;
	}
</script>

{#snippet reading()}
	<span class="value">{formatReading(value)}</span>{#if unit && value !== null}<span
			class="unit"
			class:tight={tightUnit}>{unit}</span
		>{/if}
{/snippet}

{#snippet body()}
	<div class="name">{label}</div>
	<div class="gauge-body">
		<div class="dial">
			<svg viewBox="0 0 200 112" aria-hidden="true">
				{#if value === null}
					<path class="track empty" d={arc(RADIUS, 0, 1)} />
				{:else if card.needle}
					<path class="track needle-track" d={arc(RADIUS, 0, 1)} style:stroke={ACCENT} />
					{#each bands as band, index (index)}
						<path
							class="track needle-track"
							d={arc(RADIUS, band.start, band.end)}
							style:stroke={band.segment.paint}
						/>
					{/each}
					<g class="needle" style:transform="rotate({(fraction - 0.5) * 180}deg)">
						<line x1={CX} y1={CY} x2={CX} y2={CY - NEEDLE_LENGTH} />
					</g>
					<circle class="hub" cx={CX} cy={CY} r="6" />
				{:else}
					{#each bands as band, index (index)}
						<path
							class="band"
							d={arc(BAND_RADIUS, index ? band.start + BAND_GAP : band.start, band.end)}
							style:stroke={band.segment.paint}
						/>
					{/each}
					<path class="track" d={arc(RADIUS, 0, 1)} />
					{#if fraction > 0}
						<path
							class="fill"
							d={arc(RADIUS, 0, fraction)}
							style:stroke={current?.paint ?? ACCENT}
						/>
					{/if}
				{/if}
			</svg>
			{#if value === null || !card.needle}
				<div class="reading inside" class:muted={value === null}>{@render reading()}</div>
			{/if}
		</div>
		{#if value === null}
			<div class="state">{stateText}</div>
		{:else}
			<div class="scale">
				<span>{formatReading(min)}</span>
				{#if card.needle}
					<span class="reading">{@render reading()}</span>
				{/if}
				<span>{formatReading(max)}</span>
			</div>
		{/if}
	</div>
{/snippet}

{#if openable}
	<button
		type="button"
		class="card gauge openable"
		data-entity={entity}
		data-state={stateObj?.state}
		aria-label="{label}, {formatReading(value, unit)}"
		onclick={tap}
	>
		{@render body()}
	</button>
{:else}
	<div class="card gauge" data-entity={entity} data-state={stateObj?.state}>
		{@render body()}
	</div>
{/if}

<style>
	.card {
		display: flex;
		flex-direction: column;
		gap: 10px;
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		margin: 0;
		padding: var(--h-card-padding);
		border-radius: var(--h-radius-card);
		background: rgb(var(--h-surface-rgb) / calc(0.045 * var(--h-fill-scale)));
		backdrop-filter: var(--h-surface-blur);
		box-shadow: var(--h-card-shadow);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.06 * var(--h-line-scale)));
		font: inherit;
		color: inherit;
		text-align: left;
		appearance: none;
		user-select: none;
		-webkit-user-select: none;
		overflow: hidden;
	}

	.card.openable {
		cursor: pointer;
	}

	.name {
		font-size: var(--h-type-body);
		color: var(--h-text-4);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* centered in whatever height a fill weight gives the card */
	.gauge-body {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin: auto 0;
		align-self: center;
		width: min(100%, 240px);
	}

	.dial {
		position: relative;
	}

	svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
	}

	.track,
	.fill,
	.band {
		fill: none;
	}

	.track {
		stroke: rgb(var(--h-line-rgb) / calc(0.15 * var(--h-line-scale)));
		stroke-width: 14;
		stroke-linecap: round;
	}

	.track.empty {
		stroke-dasharray: 2 22;
	}

	.track.needle-track {
		stroke-width: 10;
		stroke-linecap: butt;
		opacity: calc(0.7 * var(--h-accent-scale));
	}

	.fill {
		stroke-width: 14;
		stroke-linecap: round;
	}

	.band {
		stroke-width: 3;
		opacity: calc(0.8 * var(--h-accent-scale));
	}

	.needle {
		transform-box: view-box;
		transform-origin: 100px 104px; /* literal ok: the needle's pivot in view box units */
		transition: transform var(--h-motion-slow) var(--h-ease);
	}

	.needle line {
		stroke: var(--h-text-1);
		stroke-width: 3;
		stroke-linecap: round;
	}

	.hub {
		fill: var(--h-text-1);
	}

	.reading {
		font-family: var(--h-font-mono);
		font-weight: 500;
		line-height: 1;
		color: var(--h-text-1);
		white-space: nowrap;
	}

	.reading.inside {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		text-align: center;
		font-size: var(--h-type-display);
	}

	.reading.muted {
		color: var(--h-text-5);
	}

	.scale .reading {
		font-size: var(--h-type-headline);
	}

	.unit {
		margin-left: 0.3em;
		font-size: var(--h-type-secondary);
		color: var(--h-text-5);
		font-weight: 400;
	}

	.unit.tight {
		margin-left: 0;
	}

	.scale {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
		padding: 0 12px;
		font-family: var(--h-font-mono);
		font-size: var(--h-type-small);
		color: var(--h-text-5);
	}

	.state {
		text-align: center;
		font-size: var(--h-type-secondary);
		color: var(--h-text-5);
	}
</style>
