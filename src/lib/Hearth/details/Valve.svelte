<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import { states } from '$lib/core/ha/entities';
	import type { SliderUpdateMode } from '$lib/core/app/configuration';
	import {
		callEntityService,
		controlOverrides,
		controlValueFor,
		service
	} from '$lib/core/ha/commands';
	import { setSliderValue } from '$lib/core/domains/entity';
	import PopupSlider from '../PopupSlider.svelte';
	import { pressFeedback } from '../pressFeedback';

	let {
		entity,
		sliderUpdates = 'continuous'
	}: { entity: string; sliderUpdates?: SliderUpdateMode } = $props();

	let stateObj = $derived($states?.[entity]);
	let attributes = $derived(stateObj?.attributes ?? {});
	// ValveEntityFeature: 1 open, 2 close, 4 set position, 8 stop
	let features = $derived<number>(attributes.supported_features ?? 0);
	let position = $derived<number | null>(
		typeof attributes.current_position === 'number'
			? controlValueFor(`valve:${entity}`, attributes.current_position, $controlOverrides)
			: null
	);

	function setPosition(value: number, commit = true) {
		setSliderValue(entity, 'valve', value, commit, (next) =>
			service('valve', 'set_valve_position', { entity_id: entity, position: next })
		);
	}
</script>

<div class="segments">
	{#if (features & 1) === 1}
		<button
			type="button"
			class="segment"
			class:active={stateObj?.state === 'open'}
			use:pressFeedback={entity}
			onclick={() => callEntityService('valve', 'open_valve', entity)}
			>{$lang('hearth_open')}</button
		>
	{/if}
	{#if (features & 8) === 8}
		<button
			type="button"
			class="segment"
			use:pressFeedback={entity}
			onclick={() => callEntityService('valve', 'stop_valve', entity)}
			>{$lang('hearth_stop')}</button
		>
	{/if}
	{#if (features & 2) === 2}
		<button
			type="button"
			class="segment"
			class:active={stateObj?.state === 'closed'}
			use:pressFeedback={entity}
			onclick={() => callEntityService('valve', 'close_valve', entity)}
			>{$lang('hearth_close_valve')}</button
		>
	{/if}
</div>
{#if (features & 4) === 4 && position !== null}
	<PopupSlider
		label={$lang('hearth_position')}
		icon="valve"
		value={position}
		variant="blue"
		updateMode={sliderUpdates}
		onchange={setPosition}
	/>
{/if}
