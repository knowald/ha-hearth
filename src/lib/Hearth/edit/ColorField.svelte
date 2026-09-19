<script lang="ts">
	import { slide } from 'svelte/transition';
	import { motion } from '$lib/core/app/motion';
	import ColorPicker from './ColorPicker.svelte';

	let {
		label,
		value,
		onchange
	}: { label: string; value: string; onchange: (value: string) => void } = $props();

	let open = $state(false);
</script>

<div class="field" class:open>
	<button type="button" class="summary" aria-expanded={open} onclick={() => (open = !open)}>
		<span class="chip" style:background={value}></span>
		<span class="field-label">{label}</span>
		<span class="value">{value}</span>
	</button>

	{#if open}
		<div transition:slide={{ duration: $motion ? 160 : 0 }}>
			<ColorPicker {value} {onchange} />
		</div>
	{/if}
</div>

<style>
	.field {
		padding: 8px 10px;
		border-radius: var(--h-radius-xs);
		background: var(--h-inset);
		border: 1px solid transparent;
	}

	/* the picker needs the whole row of the grid the fields are laid out in */
	.field.open {
		grid-column: 1 / -1;
		border-color: rgb(var(--h-line-rgb) / calc(0.12 * var(--h-line-scale)));
	}

	.summary {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		cursor: pointer;
		text-align: left;
	}

	.chip {
		flex: none;
		width: 30px;
		height: 30px;
		border-radius: var(--h-radius-tight);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.15 * var(--h-line-scale)));
	}

	.field-label {
		flex: 1;
		min-width: 0;
		font-size: var(--h-type-secondary);
		color: var(--h-text-3);
	}

	.value {
		font-family: var(--h-font-mono);
		font-size: var(--h-type-label);
		letter-spacing: 1px;
		color: var(--h-text-5);
	}
</style>
