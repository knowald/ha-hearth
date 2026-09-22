<script lang="ts">
	import Ripple from '$lib/ui/actions/ripple';
	import { PRESS_RIPPLE } from './config';

	let {
		checked,
		label,
		onchange,
		pending = false
	}: {
		checked: boolean;
		label: string;
		onchange: (checked: boolean) => void;
		/** A command is in flight; the track pulses until the entity reports back. */
		pending?: boolean;
	} = $props();
</script>

<button
	type="button"
	role="switch"
	class="switch pressable"
	class:on={checked}
	class:pending
	aria-label={label}
	aria-checked={checked}
	use:Ripple={PRESS_RIPPLE}
	onclick={() => onchange(!checked)}
>
	<span class="knob"></span>
</button>

<style>
	.switch {
		box-sizing: border-box;
		flex: none;
		position: relative;
		width: 52px;
		height: 30px;
		padding: 0;
		border: 0;
		border-radius: var(--h-radius-sm);
		background: rgb(var(--h-surface-rgb) / calc(0.12 * var(--h-fill-scale)));
		cursor: pointer;
		transition: background var(--h-motion-base);
	}

	.switch.on {
		background: linear-gradient(135deg, var(--h-accent-deep), var(--h-accent-bright));
	}

	.knob {
		position: absolute;
		top: 4px;
		left: 4px;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: var(--h-icon);
		transition: left var(--h-motion-base);
	}

	.switch.on .knob {
		left: 24px;
		background: var(--h-on-accent);
	}
</style>
