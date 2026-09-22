<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import { config } from '$lib/core/ha/connection';
	import { states } from '$lib/core/ha/entities';
	import {
		callEntityService,
		controlOverrides,
		controlValueFor,
		setControlOverride
	} from '$lib/core/ha/commands';
	import { formatReading } from '../format';
	import { pressFeedback } from '../pressFeedback';

	let { entity }: { entity: string } = $props();

	let stateObj = $derived($states?.[entity]);
	let attributes = $derived(stateObj?.attributes ?? {});
	let features = $derived<number>(attributes.supported_features ?? 0);
	let unit = $derived($config?.unit_system?.temperature ?? '°');
	let step = $derived<number>(attributes.target_temp_step ?? 1);
	// rapid taps step from the optimistic value, like the climate card
	let target = $derived<number | null>(
		typeof attributes.temperature === 'number'
			? controlValueFor(`water_heater:${entity}`, attributes.temperature, $controlOverrides)
			: null
	);
	let min = $derived<number>(attributes.min_temp ?? 30);
	let max = $derived<number>(attributes.max_temp ?? 80);
	let modes = $derived<string[]>(
		Array.isArray(attributes.operation_list) ? attributes.operation_list : []
	);

	function stepTarget(direction: number) {
		if (target === null) return;
		// rounding after clamping could step back over the bound
		const next = Math.round((target + direction * step) / step) * step;
		const temperature = Math.min(max, Math.max(min, Number(next.toPrecision(12))));
		setControlOverride(`water_heater:${entity}`, temperature, 5000);
		callEntityService('water_heater', 'set_temperature', entity, { temperature });
	}
</script>

{#if (features & 1) === 1 && target !== null}
	<div class="label">{$lang('hearth_target_temperature')}</div>
	<div class="stepper">
		<button
			type="button"
			class="step"
			use:pressFeedback={entity}
			aria-label={$lang('hearth_decrease')}
			onclick={() => stepTarget(-1)}>-</button
		>
		<div><span class="value">{formatReading(target)}</span><span class="unit">{unit}</span></div>
		<button
			type="button"
			class="step"
			use:pressFeedback={entity}
			aria-label={$lang('hearth_increase')}
			onclick={() => stepTarget(1)}>+</button
		>
	</div>
{/if}
{#if (features & 2) === 2 && modes.length}
	<div class="label">{$lang('hearth_operation_mode')}</div>
	<div class="segments">
		{#each modes as mode (mode)}
			<button
				type="button"
				class="segment"
				use:pressFeedback={entity}
				class:active={attributes.operation_mode === mode}
				onclick={() =>
					callEntityService('water_heater', 'set_operation_mode', entity, { operation_mode: mode })}
			>
				{mode}
			</button>
		{/each}
	</div>
{/if}
{#if (features & 4) === 4}
	<div class="label">{$lang('hearth_away_mode')}</div>
	<div class="segments">
		<button
			type="button"
			class="segment"
			use:pressFeedback={entity}
			class:active={attributes.away_mode === 'on'}
			onclick={() =>
				callEntityService('water_heater', 'set_away_mode', entity, { away_mode: true })}
		>
			{$lang('on')}
		</button>
		<button
			type="button"
			class="segment"
			use:pressFeedback={entity}
			class:active={attributes.away_mode !== 'on'}
			onclick={() =>
				callEntityService('water_heater', 'set_away_mode', entity, { away_mode: false })}
		>
			{$lang('off')}
		</button>
	</div>
{/if}
