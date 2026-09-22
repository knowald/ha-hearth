<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import { states, sensorNumber } from '$lib/core/ha/entities';
	import type { SliderUpdateMode } from '$lib/core/app/configuration';
	import StateLogic from '$lib/ui/StateLogic.svelte';
	import { detailLoader } from './details';
	import SensorPopup from './SensorPopup.svelte';
	import './details/detail.css';

	let {
		entity,
		sliderUpdates = undefined,
		readonly = false
	}: { entity: string; sliderUpdates?: SliderUpdateMode; readonly?: boolean } = $props();

	// attributes that the header, the icon or the controls already express
	const HIDDEN = new Set([
		'friendly_name',
		'icon',
		'supported_features',
		'entity_picture',
		'attribution',
		'editable',
		'id'
	]);

	let stateObj = $derived($states?.[entity]);
	// the domain component is where every command lives
	let loader = $derived(readonly ? undefined : detailLoader(entity));
	// a numeric reading without controls gets the big reading and its history,
	// which already say what the state line would
	let numeric = $derived(!loader && sensorNumber(stateObj?.state) !== null);
	let attributes = $derived(
		Object.entries(stateObj?.attributes ?? {}).filter(([key]) => !HIDDEN.has(key))
	);
	let showAttributes = $state(false);

	function format(value: unknown): string {
		if (typeof value === 'string') return value;
		if (typeof value === 'number' || typeof value === 'boolean') return String(value);
		if (value === null || value === undefined) return '-';
		return JSON.stringify(value);
	}
</script>

<div class="detail">
	{#if !numeric}
		<div class="state-line">
			{#if stateObj}
				<StateLogic entity_id={entity} />
			{:else}
				{$lang('hearth_missing_entity')}
			{/if}
		</div>
	{/if}

	{#if loader}
		{#await loader() then module}
			<module.default {entity} {sliderUpdates} />
		{/await}
	{:else if numeric}
		<SensorPopup {entity} />
	{:else}
		<div class="note">{$lang('hearth_no_controls')}</div>
	{/if}

	{#if attributes.length}
		<button
			type="button"
			class="attributes-toggle"
			aria-expanded={showAttributes}
			onclick={() => (showAttributes = !showAttributes)}
		>
			<span class="label">{$lang('hearth_detail_attributes')}</span>
			<span class="count">{attributes.length}</span>
		</button>
		{#if showAttributes}
			<dl class="attributes">
				{#each attributes as [key, value] (key)}
					<div class="readout">
						<dt>{key}</dt>
						<dd><strong>{format(value)}</strong></dd>
					</div>
				{/each}
			</dl>
		{/if}
	{/if}
	<div class="entity-id">{entity}</div>
</div>

<style>
	.state-line {
		margin-top: 6px;
		font-size: var(--h-type-emphasis);
		color: var(--h-text-3);
	}

	.attributes-toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		margin-top: 18px;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.attributes-toggle .label {
		margin: 0;
	}

	.count {
		font-family: var(--h-font-mono);
		font-size: var(--h-type-label);
		color: var(--h-text-6);
	}

	.attributes {
		margin: 8px 0 0;
	}

	dt,
	dd {
		margin: 0;
	}

	dt {
		flex: none;
		max-width: 45%;
		overflow-wrap: anywhere;
	}

	.entity-id {
		margin-top: 16px;
		font-family: var(--h-font-mono);
		font-size: var(--h-type-label);
		color: var(--h-text-6);
		overflow-wrap: anywhere;
	}
</style>
