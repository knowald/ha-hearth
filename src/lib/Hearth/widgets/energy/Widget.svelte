<script lang="ts">
	import { ICON } from '../../iconSizes';
	import { lang } from '$lib/core/i18n';
	import { connected } from '$lib/core/ha/connection';
	import { states } from '$lib/core/ha/entities';
	import type { RailWidget } from '../../config';
	import { fetchStatistics, startDataRefresh } from '$lib/core/ha/history';
	import { usagePerRow } from '../../model/widgets/energy';
	import { sensorNumber } from '$lib/core/ha/entities';
	import { openEntityDetail } from '$lib/Hearth/details';
	import Icon from '../../Icon.svelte';

	let { widget }: { widget: Extract<RailWidget, { type: 'energy' }> } = $props();

	// a long-term statistic id need not be an entity; only an entity has a detail sheet
	let openable = $derived(!!widget.entity && !!$states?.[widget.entity]);

	const BAR_COUNT = 8;
	// kWh per hour for today, oldest first; null until the first fetch lands
	let hours = $state<number[] | null>(null);
	$effect(() => {
		void widget.entity;
		hours = null;
	});

	$effect(() => {
		const entityId = widget.entity;
		if (!$connected || !entityId) return;
		// narrowed here; the closure below would see string | undefined again
		const statisticId: string = entityId;

		async function fetchToday() {
			const now = new Date();
			const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
			return usagePerRow(
				(await fetchStatistics([statisticId], start, new Date(), 'hour'))[statisticId] ?? []
			);
		}

		return startDataRefresh(fetchToday, (value) => (hours = value));
	});

	// the comparison code loads only once a widget wants the badge
	let belowAverage = $state(false);
	$effect(() => {
		const entityId = widget.entity;
		belowAverage = false;
		if (!$connected || !entityId || widget.average_badge === false) return;
		let stop: (() => void) | undefined;
		let cancelled = false;
		import('./average')
			.then(({ watchWeekAverage }) => {
				if (!cancelled) stop = watchWeekAverage(entityId, (below) => (belowAverage = below));
			})
			.catch(() => {
				// a failed chunk only costs the badge
			});
		return () => {
			cancelled = true;
			stop?.();
		};
	});

	let total = $derived(hours ? hours.reduce((sum, value) => sum + value, 0) : null);

	let pricePerKwh = $derived(
		widget.price_entity
			? sensorNumber($states?.[widget.price_entity]?.state)
			: typeof widget.price === 'number'
				? widget.price
				: null
	);

	let cost = $derived(
		total !== null && pricePerKwh !== null
			? `${(total * pricePerKwh).toFixed(2)}${widget.currency ? ` ${widget.currency}` : ''}`
			: null
	);

	// last BAR_COUNT hours ending at the current hour; height relative to the
	// day's peak hour, opacity ramping toward now, current hour solid
	let bars = $derived.by(() => {
		if (!hours || !hours.length) return [];
		const recent = hours.slice(-BAR_COUNT);
		const max = Math.max(...recent, 0.001);
		return recent.map((value, index) => ({
			height: Math.max(3, Math.round((value / max) * 24)),
			current: index === recent.length - 1,
			alpha: 0.25 + (index / Math.max(1, recent.length - 1)) * 0.3
		}));
	});
</script>

{#snippet content()}
	<div class="header">
		<Icon name="bolt" size={ICON.control} color="rgb(var(--h-accent-rgb))" fill />
		<span class="title">{$lang('hearth_energy')}</span>
		<span class="reading">
			{#if total !== null}
				<span class="value">{total.toFixed(1)} kWh</span>
				{#if cost}
					<span class="cost">· {cost}</span>
				{/if}
			{:else}
				<span class="cost">-</span>
			{/if}
		</span>
	</div>
	{#if belowAverage}
		<div class="badge">
			<Icon name="eco" size={ICON.inline} fill />
			<span>{$lang('hearth_energy_below_week_average')}</span>
		</div>
	{/if}
	{#if bars.length}
		<div class="bars">
			{#each bars as bar, index (index)}
				<span
					class="bar"
					style:height="{bar.height}px"
					style:background={bar.current
						? 'rgb(var(--h-accent-rgb))'
						: `rgb(var(--h-accent-rgb) / calc(${bar.alpha} * var(--h-accent-scale)))`}
				></span>
			{/each}
		</div>
	{/if}
{/snippet}
{#if openable}
	<button type="button" class="card pressable" onclick={() => openEntityDetail(widget.entity!)}>
		{@render content()}
	</button>
{:else}
	<div class="card">{@render content()}</div>
{/if}

<style>
	.card {
		padding: var(--h-card-padding);
		border-radius: var(--h-radius-card);
		background: rgb(var(--h-surface-rgb) / calc(0.045 * var(--h-fill-scale)));
		backdrop-filter: var(--h-surface-blur);
		box-shadow: var(--h-card-shadow);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.07 * var(--h-line-scale)));
		margin-bottom: 8px;
		display: block;
		width: 100%;
		font: inherit;
		color: inherit;
		text-align: left;
	}

	button.card {
		cursor: pointer;
	}

	.header {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.title {
		font-size: var(--h-type-secondary);
		color: var(--h-text-3);
	}

	.reading {
		margin-left: auto;
		display: flex;
		align-items: baseline;
		gap: 6px;
	}

	.value {
		font-size: var(--h-type-body);
		font-weight: 600;
		color: var(--h-text-1);
	}

	.cost {
		font-size: var(--h-type-small);
		color: var(--h-text-5);
	}

	.badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		margin-top: 8px;
		padding: 2px 8px;
		border-radius: var(--h-radius-pill);
		background: color-mix(in srgb, var(--h-good) 12%, transparent);
		color: var(--h-good-text);
		font-size: var(--h-type-small);
	}

	.bars {
		display: flex;
		align-items: flex-end;
		gap: 4px;
		height: 24px;
		margin-top: 10px;
	}

	.bar {
		flex: 1;
		border-radius: var(--h-radius-hair);
	}
</style>
