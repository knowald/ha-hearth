<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import { states } from '$lib/core/ha/entities';
	import type { SliderUpdateMode } from '$lib/core/app/configuration';
	import { getSupport } from '$lib/core/ha/entities';
	import Ripple from '$lib/ui/actions/ripple';
	import { PRESS_RIPPLE } from './config';
	import {
		blindPositionFor,
		blindTiltFor,
		coverIsAccessPoint,
		guardCoverMotion,
		setBlindPosition,
		setBlindTiltPosition
	} from '$lib/core/domains/cover';
	import { callEntityService, controlOverrides } from '$lib/core/ha/commands';
	import { requestConfirmation } from './store';
	import PopupSlider from './PopupSlider.svelte';
	import './buttons.css';

	let {
		entity,
		sliderUpdates = 'continuous'
	}: { entity: string; sliderUpdates?: SliderUpdateMode } = $props();

	let attributes = $derived($states?.[entity]?.attributes);

	let supports = $derived(
		getSupport(attributes?.supported_features, {
			STOP: 8,
			OPEN_TILT: 16,
			CLOSE_TILT: 32,
			STOP_TILT: 64,
			SET_TILT_POSITION: 128
		})
	);

	let tiltPosition = $derived(blindTiltFor(entity, $states, $controlOverrides));
	let position = $derived(blindPositionFor(entity, $states, $controlOverrides));
	let accessPoint = $derived(coverIsAccessPoint($states?.[entity]));

	function moveTo(target: number) {
		const current = blindPositionFor(entity, $states, {});
		guardCoverMotion(
			[entity],
			target > current,
			() => setBlindPosition(entity, target),
			requestConfirmation
		);
	}

	// an access point's slider only commits on release, so it asks once per drag
	function slide(value: number, commit?: boolean) {
		setBlindPosition(entity, value, false);
		if (commit) moveTo(value);
	}

	function callCoverService(service: string, data: Record<string, unknown> = {}) {
		callEntityService('cover', service, entity, data);
	}
</script>

<PopupSlider
	label={$lang('hearth_position')}
	icon="blinds"
	value={position}
	variant="blue"
	updateMode={accessPoint ? 'release' : sliderUpdates}
	onchange={slide}
/>

<div class="buttons">
	<button
		type="button"
		class="hearth-button secondary pressable"
		use:Ripple={PRESS_RIPPLE}
		onclick={() => moveTo(0)}
	>
		{$lang('hearth_close_cover')}
	</button>
	{#if supports?.STOP}
		<button
			type="button"
			class="hearth-button secondary pressable"
			use:Ripple={PRESS_RIPPLE}
			onclick={() => callCoverService('stop_cover')}
		>
			{$lang('stop')}
		</button>
	{/if}
	<button
		type="button"
		class="hearth-button primary pressable"
		use:Ripple={PRESS_RIPPLE}
		onclick={() => moveTo(100)}
	>
		{$lang('hearth_open_fully')}
	</button>
</div>

{#if supports?.SET_TILT_POSITION}
	<PopupSlider
		label={$lang('hearth_tilt')}
		icon="tune"
		value={tiltPosition}
		variant="blue"
		updateMode={sliderUpdates}
		onchange={(value, commit) => setBlindTiltPosition(entity, value, commit)}
	/>
{/if}

{#if supports?.CLOSE_TILT || supports?.STOP_TILT || supports?.OPEN_TILT}
	<div class="buttons">
		{#if supports?.CLOSE_TILT}
			<button
				type="button"
				class="hearth-button secondary pressable"
				use:Ripple={PRESS_RIPPLE}
				onclick={() => callCoverService('close_cover_tilt')}
			>
				{$lang('hearth_close_tilt')}
			</button>
		{/if}
		{#if supports?.STOP_TILT}
			<button
				type="button"
				class="hearth-button secondary pressable"
				use:Ripple={PRESS_RIPPLE}
				onclick={() => callCoverService('stop_cover_tilt')}
			>
				{$lang('hearth_stop_tilt')}
			</button>
		{/if}
		{#if supports?.OPEN_TILT}
			<button
				type="button"
				class="hearth-button primary pressable"
				use:Ripple={PRESS_RIPPLE}
				onclick={() => callCoverService('open_cover_tilt')}
			>
				{$lang('hearth_open_tilt')}
			</button>
		{/if}
	</div>
{/if}

<style>
	.buttons {
		display: flex;
		gap: 10px;
		margin-top: 16px;
	}

	.hearth-button {
		flex: 1;
	}

	/* covers keep the cool hue their slider uses */
	.hearth-button.primary {
		background: linear-gradient(135deg, rgb(var(--h-cool-rgb)), var(--h-cool-light));
		color: var(--h-on-cool);
	}
</style>
