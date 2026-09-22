<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import { entityControllable, states, sensorNumber } from '$lib/core/ha/entities';
	import type { SliderUpdateMode } from '$lib/core/app/configuration';
	import { controlOverrides, controlValueFor, markPending, service } from '$lib/core/ha/commands';
	import { setSliderValue } from '$lib/core/domains/entity';
	import { formatReading, stepDecimals } from '../format';
	import PopupSlider from '../PopupSlider.svelte';
	import { pressFeedback } from '../pressFeedback';

	let {
		entity,
		sliderUpdates = 'continuous'
	}: { entity: string; sliderUpdates?: SliderUpdateMode } = $props();

	let stateObj = $derived($states?.[entity]);
	let attributes = $derived(stateObj?.attributes ?? {});
	let domain = $derived(entity.split('.')[0]);
	let min = $derived(typeof attributes.min === 'number' ? attributes.min : 0);
	let max = $derived(typeof attributes.max === 'number' ? attributes.max : 100);
	let step = $derived(typeof attributes.step === 'number' ? attributes.step : 1);
	let unit = $derived(attributes.unit_of_measurement ?? '');
	// rapid steps and drags build on the value already sent, not the last confirmed one
	let shown = $derived(
		controlValueFor(`value:${entity}`, sensorNumber(stateObj?.state) ?? min, $controlOverrides)
	);

	function stepBy(direction: number) {
		set(shown + direction * step);
		if (entityControllable(stateObj)) markPending(entity);
	}

	function set(value: number, commit = true) {
		const clamped = Math.min(max, Math.max(min, Number(value.toPrecision(12))));
		setSliderValue(entity, 'value', clamped, commit, (next) =>
			service(domain, 'set_value', { entity_id: entity, value: next })
		);
	}
</script>

<div class="stepper">
	<button
		type="button"
		class="step"
		aria-label={$lang('hearth_decrease')}
		use:pressFeedback={entity}
		onclick={() => stepBy(-1)}>-</button
	>
	<div>
		<span class="value">{formatReading(shown, '', stepDecimals(step))}</span><span class="unit"
			>{unit}</span
		>
	</div>
	<button
		type="button"
		class="step"
		aria-label={$lang('hearth_increase')}
		use:pressFeedback={entity}
		onclick={() => stepBy(1)}>+</button
	>
</div>
<PopupSlider
	label={$lang('hearth_value')}
	icon="tune"
	value={shown}
	variant="amber"
	{min}
	{max}
	{step}
	{unit}
	updateMode={sliderUpdates}
	onchange={set}
/>
