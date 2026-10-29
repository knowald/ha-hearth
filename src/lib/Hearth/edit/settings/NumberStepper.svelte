<script lang="ts">
	import { ICON } from '../../iconSizes';
	import Icon from '../../Icon.svelte';

	/*
	 * A number input in a bordered frame for a settings row. With `onstep` it
	 * gets minus and plus buttons around the value.
	 */
	let {
		label,
		value,
		min,
		max,
		step,
		unit,
		invalid = false,
		wide = false,
		decreaseLabel,
		increaseLabel,
		onstep,
		onchange
	}: {
		label: string;
		value: number | undefined;
		min: number;
		max: number;
		/** The input's own step attribute, such as `any` for decimals. */
		step?: string;
		unit?: string;
		invalid?: boolean;
		/** Room for a longer value, such as a coordinate. */
		wide?: boolean;
		decreaseLabel?: string;
		increaseLabel?: string;
		onstep?: (direction: -1 | 1) => void;
		onchange: (input: HTMLInputElement) => void;
	} = $props();
</script>

<span class="unit-input">
	<span class="stepper field-frame">
		{#if onstep}
			<button type="button" class="step" aria-label={decreaseLabel} onclick={() => onstep(-1)}>
				<Icon name="remove" size={ICON.inline} />
			</button>
		{/if}
		<input
			class:coordinate={wide}
			type="number"
			{step}
			{min}
			{max}
			aria-label={label}
			aria-invalid={invalid || undefined}
			{value}
			onchange={(event) => onchange(event.currentTarget)}
		/>
		{#if onstep}
			<button type="button" class="step" aria-label={increaseLabel} onclick={() => onstep(1)}>
				<Icon name="add" size={ICON.inline} />
			</button>
		{/if}
	</span>
	{#if unit}<span class="unit">{unit}</span>{/if}
</span>

<style>
	.unit-input input.coordinate {
		width: 112px;
		padding: 8px 12px;
	}

	.unit-input {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: none;
	}

	/* px and % differ in width; a fixed slot keeps the steppers aligned */
	.unit {
		min-width: 2ch;
		font-size: var(--h-type-secondary);
		color: var(--h-text-6);
	}

	/* minus, value, plus in one bordered group; the native spinner is hidden */
	.stepper {
		display: flex;
		align-items: center;
		border-radius: var(--h-radius-xs);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.1 * var(--h-line-scale)));
		background: rgb(var(--h-surface-rgb) / calc(0.06 * var(--h-fill-scale)));
	}

	.stepper:focus-within {
		border-color: rgb(var(--h-accent-rgb) / calc(0.4 * var(--h-accent-scale)));
	}

	.step {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border: 0;
		background: none;
		color: var(--h-icon);
		cursor: pointer;
	}

	@media (hover: hover) {
		.step:hover {
			color: var(--h-accent-text);
		}
	}

	.unit-input input {
		width: 48px;
		text-align: center;
		padding: 8px 0;
		border: 0;
		background: none;
		color: var(--h-text-2);
		font-family: inherit;
		font-size: var(--h-type-body);
		outline: none;
	}

	/* the native spinner paints white over the dark field and eats the padding */
	.unit-input input[type='number'] {
		appearance: textfield;
		-moz-appearance: textfield;
	}

	.unit-input input::-webkit-outer-spin-button,
	.unit-input input::-webkit-inner-spin-button {
		appearance: none;
		margin: 0;
	}
</style>
