<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import { config } from '$lib/core/ha/connection';
	import { states } from '$lib/core/ha/entities';
	import { callEntityService, controlOverrides, controlValueFor } from '$lib/core/ha/commands';
	import { setClimateHvacMode, setClimateTemperature } from '$lib/core/domains/climate';
	import { formatReading } from '../format';
	import { pressFeedback } from '../pressFeedback';

	let { entity }: { entity: string } = $props();

	let stateObj = $derived($states?.[entity]);
	let attributes = $derived(stateObj?.attributes ?? {});
	let step = $derived<number>(attributes.target_temp_step ?? 0.5);
	let min = $derived<number>(attributes.min_temp ?? 7);
	let max = $derived<number>(attributes.max_temp ?? 35);
	let unit = $derived($config?.unit_system?.temperature ?? '°');
	// rapid taps step from the optimistic value, like the climate card
	let target = $derived<number | null>(
		typeof attributes.temperature === 'number'
			? controlValueFor(`climate:${entity}`, attributes.temperature, $controlOverrides)
			: null
	);
	let low = $derived<number | null>(
		typeof attributes.target_temp_low === 'number' ? attributes.target_temp_low : null
	);
	let high = $derived<number | null>(
		typeof attributes.target_temp_high === 'number' ? attributes.target_temp_high : null
	);
	let current = $derived<number | null>(
		typeof attributes.current_temperature === 'number' ? attributes.current_temperature : null
	);
	let hvacModes = $derived<string[]>(
		Array.isArray(attributes.hvac_modes) ? attributes.hvac_modes : []
	);
	let presetModes = $derived<string[]>(
		Array.isArray(attributes.preset_modes) ? attributes.preset_modes : []
	);
	let fanModes = $derived<string[]>(
		Array.isArray(attributes.fan_modes) ? attributes.fan_modes : []
	);
	let swingModes = $derived<string[]>(
		Array.isArray(attributes.swing_modes) ? attributes.swing_modes : []
	);

	function clamp(value: number) {
		// rounding after clamping could step back over the bound
		return Math.min(max, Math.max(min, Math.round(value / step) * step));
	}

	function setRange(nextLow: number, nextHigh: number) {
		callEntityService('climate', 'set_temperature', entity, {
			target_temp_low: clamp(nextLow),
			target_temp_high: clamp(nextHigh)
		});
	}
</script>

{#if current !== null}
	<div class="readout">
		<span>{$lang('hearth_current')}</span><strong>{formatReading(current, unit)}</strong>
	</div>
{/if}
{#if target !== null}
	<div class="label">{$lang('hearth_target_temperature')}</div>
	<div class="stepper">
		<button
			type="button"
			class="step"
			use:pressFeedback={entity}
			aria-label={$lang('hearth_decrease')}
			onclick={() => setClimateTemperature(entity, clamp(target - step))}>-</button
		>
		<div><span class="value">{formatReading(target)}</span><span class="unit">{unit}</span></div>
		<button
			type="button"
			class="step"
			use:pressFeedback={entity}
			aria-label={$lang('hearth_increase')}
			onclick={() => setClimateTemperature(entity, clamp(target + step))}>+</button
		>
	</div>
{:else if low !== null && high !== null}
	<div class="label">{$lang('hearth_target_temperature')}</div>
	<div class="stepper">
		<button
			type="button"
			class="step"
			use:pressFeedback={entity}
			aria-label={$lang('hearth_decrease')}
			onclick={() => setRange(low - step, high)}>-</button
		>
		<div><span class="value">{formatReading(low)}</span><span class="unit">{unit}</span></div>
		<button
			type="button"
			class="step"
			use:pressFeedback={entity}
			aria-label={$lang('hearth_increase')}
			onclick={() => setRange(low + step, high)}>+</button
		>
	</div>
	<div class="stepper">
		<button
			type="button"
			class="step"
			use:pressFeedback={entity}
			aria-label={$lang('hearth_decrease')}
			onclick={() => setRange(low, high - step)}>-</button
		>
		<div><span class="value">{formatReading(high)}</span><span class="unit">{unit}</span></div>
		<button
			type="button"
			class="step"
			use:pressFeedback={entity}
			aria-label={$lang('hearth_increase')}
			onclick={() => setRange(low, high + step)}>+</button
		>
	</div>
{/if}
{#if hvacModes.length}
	<div class="label">{$lang('hearth_hvac_mode')}</div>
	<div class="segments">
		{#each hvacModes as mode (mode)}
			<button
				type="button"
				class="segment"
				use:pressFeedback={entity}
				class:active={stateObj?.state === mode}
				onclick={() => setClimateHvacMode(entity, mode)}>{$lang(mode)}</button
			>
		{/each}
	</div>
{/if}
{#if presetModes.length}
	<div class="label">{$lang('hearth_preset')}</div>
	<div class="segments">
		{#each presetModes as mode (mode)}
			<button
				type="button"
				class="segment"
				use:pressFeedback={entity}
				class:active={attributes.preset_mode === mode}
				onclick={() =>
					callEntityService('climate', 'set_preset_mode', entity, { preset_mode: mode })}
				>{mode}</button
			>
		{/each}
	</div>
{/if}
{#if fanModes.length}
	<div class="label">{$lang('hearth_fan_mode')}</div>
	<div class="segments">
		{#each fanModes as mode (mode)}
			<button
				type="button"
				class="segment"
				use:pressFeedback={entity}
				class:active={attributes.fan_mode === mode}
				onclick={() => callEntityService('climate', 'set_fan_mode', entity, { fan_mode: mode })}
				>{mode}</button
			>
		{/each}
	</div>
{/if}
{#if swingModes.length}
	<div class="label">{$lang('hearth_swing_mode')}</div>
	<div class="segments">
		{#each swingModes as mode (mode)}
			<button
				type="button"
				class="segment"
				use:pressFeedback={entity}
				class:active={attributes.swing_mode === mode}
				onclick={() => callEntityService('climate', 'set_swing_mode', entity, { swing_mode: mode })}
				>{mode}</button
			>
		{/each}
	</div>
{/if}
