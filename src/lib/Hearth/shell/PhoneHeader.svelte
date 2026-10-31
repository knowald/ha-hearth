<script lang="ts">
	import { lang, selectedLanguage } from '$lib/core/i18n';
	import { entityAvailable, states } from '$lib/core/ha/entities';
	import { ICON } from '../iconSizes';
	import { phoneHeader, railPositionOf } from '../config';
	import { openEntityDetail } from '../details';
	import { hearthConfig } from '../store';
	import { conditionIcon } from '../widgets/weather/conditions';
	import Icon from '../Icon.svelte';
	import PhoneClock from './PhoneClock.svelte';

	/**
	 * One row of time, date and current weather above the folded page, in
	 * place of the clock and weather widgets (see phoneHeader in config.ts).
	 */
	let { compact = false }: { compact?: boolean } = $props();

	let parts = $derived(
		phoneHeader($hearthConfig.rail, { compact, position: railPositionOf($hearthConfig) })
	);
	let entity = $derived(parts.weather ? $states?.[parts.weather] : undefined);
	let available = $derived(entityAvailable(entity));
	let condition = $derived(available ? (entity?.state ?? '') : '');
	let temperature = $derived(entity?.attributes?.temperature);
	let reading = $derived(
		available && typeof temperature === 'number'
			? `${Intl.NumberFormat($selectedLanguage).format(Math.round(temperature))}\u00b0`
			: '-'
	);
	let summary = $derived(
		available ? `${$lang(`weather_${condition.replaceAll('-', '_')}`)}, ${reading}` : ''
	);
</script>

{#if parts.time || entity}
	<header class="phone-header">
		{#if parts.time}
			<PhoneClock inline />
		{/if}
		{#if entity}
			<button
				type="button"
				class="weather pressable"
				aria-label={summary || $lang('unavailable')}
				onclick={() => openEntityDetail(entity.entity_id)}
			>
				<Icon
					name={available ? conditionIcon(condition) : 'cloud_off'}
					size={ICON.inline}
					color={available ? 'rgb(var(--h-accent-rgb))' : 'var(--h-icon)'}
					fill={available}
				/>
				<span>{reading}</span>
			</button>
		{/if}
	</header>
{/if}

<style>
	.phone-header {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 44px;
		padding: 0 14px;
		border-radius: var(--h-radius-pill);
		background: rgb(var(--h-surface-rgb) / calc(0.045 * var(--h-fill-scale)));
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.09 * var(--h-line-scale)));
		backdrop-filter: var(--h-surface-blur);
		min-width: 0;
	}

	.weather {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 6px;
		min-height: 44px;
		padding: 0 4px;
		border: 0;
		background: none;
		color: var(--h-text-1);
		font: inherit;
		font-size: var(--h-type-body);
		font-variant-numeric: tabular-nums;
		cursor: pointer;
	}
</style>
