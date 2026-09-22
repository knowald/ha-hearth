<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import { entityActiveFor, states } from '$lib/core/ha/entities';
	import type { SliderUpdateMode } from '$lib/core/app/configuration';
	import {
		callEntityService,
		controlOverrides,
		controlValueFor,
		service
	} from '$lib/core/ha/commands';
	import { setEntityActive, setSliderValue } from '$lib/core/domains/entity';
	import PopupSlider from '../PopupSlider.svelte';
	import { pressFeedback } from '../pressFeedback';

	let {
		entity,
		sliderUpdates = 'continuous'
	}: { entity: string; sliderUpdates?: SliderUpdateMode } = $props();

	let stateObj = $derived($states?.[entity]);
	let attributes = $derived(stateObj?.attributes ?? {});
	let on = $derived(entityActiveFor(entity, stateObj, $controlOverrides));
	let humidity = $derived(
		controlValueFor(`humidity:${entity}`, attributes.humidity ?? 50, $controlOverrides)
	);
	let min = $derived<number>(attributes.min_humidity ?? 0);
	let max = $derived<number>(attributes.max_humidity ?? 100);
	let step = $derived<number>(attributes.target_humidity_step ?? 1);
	let modes = $derived<string[]>(
		Array.isArray(attributes.available_modes) ? attributes.available_modes : []
	);

	function setHumidity(value: number, commit = true) {
		setSliderValue(entity, 'humidity', value, commit, (next) =>
			service('humidifier', 'set_humidity', { entity_id: entity, humidity: next })
		);
	}
</script>

<div class="segments">
	<button
		type="button"
		class="segment"
		class:active={on}
		use:pressFeedback={entity}
		onclick={() => setEntityActive(entity, true)}>{$lang('hearth_turn_on')}</button
	>
	<button
		type="button"
		class="segment"
		class:active={!on}
		use:pressFeedback={entity}
		onclick={() => setEntityActive(entity, false)}>{$lang('hearth_turn_off')}</button
	>
</div>
<PopupSlider
	label={$lang('hearth_target_humidity')}
	icon="humidity_mid"
	value={humidity}
	variant="blue"
	{min}
	{max}
	{step}
	updateMode={sliderUpdates}
	onchange={setHumidity}
/>
{#if modes.length}
	<div class="label">{$lang('hearth_mode')}</div>
	<div class="segments">
		{#each modes as mode (mode)}
			<button
				type="button"
				class="segment"
				class:active={attributes.mode === mode}
				use:pressFeedback={entity}
				onclick={() => callEntityService('humidifier', 'set_mode', entity, { mode })}
			>
				{mode}
			</button>
		{/each}
	</div>
{/if}
