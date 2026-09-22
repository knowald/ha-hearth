<script lang="ts">
	import { ICON } from '../iconSizes';
	import { lang } from '$lib/core/i18n';
	import Ripple from '$lib/ui/actions/ripple';
	import { activateOnKeyboard } from '../interaction';
	import { PRESS_RIPPLE, type VisibilityCondition } from '../config';
	import Icon from '../Icon.svelte';
	import VisibilityField from './VisibilityField.svelte';

	let {
		value = $bindable([]),
		hiddenElsewhere = false,
		onalwaysvisible = undefined
	}: {
		value?: VisibilityCondition[];
		/** Another setting (a widget hidden on phones) already hides it somewhere. */
		hiddenElsewhere?: boolean;
		/** Clears that other setting when "Always visible" is chosen. */
		onalwaysvisible?: () => void;
	} = $props();

	let conditionsOpen = $state(value.length > 0);
	let alwaysVisible = $derived(!hiddenElsewhere && value.length === 0);

	function setAlwaysVisible() {
		onalwaysvisible?.();
		value = [];
		conditionsOpen = false;
	}

	function toggleConditions() {
		conditionsOpen = !conditionsOpen;
	}
</script>

<div class="chips">
	<span
		class="chip pressable"
		class:active={alwaysVisible}
		use:Ripple={PRESS_RIPPLE}
		role="button"
		tabindex="0"
		aria-pressed={alwaysVisible}
		onclick={setAlwaysVisible}
		onkeydown={(event) => activateOnKeyboard(event, setAlwaysVisible)}
	>
		<Icon name="visibility" size={ICON.inline} />
		{$lang('hearth_always_visible')}
	</span>
	<span
		class="chip pressable"
		class:active={value.length > 0 || conditionsOpen}
		use:Ripple={PRESS_RIPPLE}
		role="button"
		tabindex="0"
		aria-expanded={conditionsOpen}
		onclick={toggleConditions}
		onkeydown={(event) => activateOnKeyboard(event, toggleConditions)}
	>
		<Icon name="rule" size={ICON.inline} />
		{$lang('conditions')}{value.length ? ` (${value.length})` : ''}
	</span>
</div>

{#if conditionsOpen}
	<VisibilityField bind:value />
{/if}
