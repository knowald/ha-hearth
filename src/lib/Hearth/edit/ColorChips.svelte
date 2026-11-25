<script lang="ts" module>
	import { styleColor } from '../visibility';

	// the order of the chips, each with its label
	const ROLE_LABELS = {
		good: 'hearth_good',
		accent: 'hearth_accent',
		bad: 'hearth_bad',
		cool: 'hearth_cool'
	} as const;
	const ROLES = Object.keys(ROLE_LABELS) as (keyof typeof ROLE_LABELS)[];

	export function isColorRole(color: string): boolean {
		return (ROLES as readonly string[]).includes(color.trim().toLowerCase());
	}

	/** Typed text that is no color styleColor can read. */
	export function colorError(color: string | undefined): boolean {
		return !!color?.trim() && !styleColor(color);
	}
</script>

<!--
	A color as a theme role or a CSS color, chosen with one chip per role and
	a Custom chip that opens a text field. Custom is any value that is not a
	role, blank included, so the choice lives in the value and survives a row
	being removed above it. With `automatic`, an undefined value is a choice of
	its own: the Default chip, for a color the card picks, drawn in that color.
-->
<script lang="ts" generics="T extends string | undefined">
	import { lang } from '$lib/core/i18n';
	import TextField from './TextField.svelte';

	let {
		value = $bindable(),
		automatic = undefined,
		customLabel
	}: {
		value: T;
		/** The color the card picks when none is set, which offers the Default chip. */
		automatic?: { paint: string; faded: boolean };
		customLabel: string;
	} = $props();

	let custom = $derived(value !== undefined && !isColorRole(value));
	let role = $derived(value?.trim().toLowerCase());

	function chooseCustom() {
		if (value === undefined || isColorRole(value)) value = '' as T;
	}
</script>

<div class="chips color-chips" role="group" aria-label={$lang('hearth_color')}>
	{#if automatic}
		<button
			type="button"
			class="chip"
			class:active={value === undefined}
			aria-pressed={value === undefined}
			onclick={() => (value = undefined as T)}
		>
			<span class="swatch" class:faded={automatic.faded} style:background={automatic.paint}></span>
			{$lang('hearth_default')}
		</button>
	{/if}
	{#each ROLES as option (option)}
		<button
			type="button"
			class="chip"
			class:active={role === option}
			aria-pressed={role === option}
			onclick={() => (value = option as T)}
		>
			<span class="swatch" style:background={styleColor(option)}></span>
			{$lang(ROLE_LABELS[option])}
		</button>
	{/each}
	<button
		type="button"
		class="chip"
		class:active={custom}
		aria-pressed={custom}
		onclick={chooseCustom}
	>
		<span
			class="swatch"
			class:open={!custom || !styleColor(value)}
			style:background={custom ? styleColor(value) : undefined}
		></span>
		{$lang('hearth_custom')}
	</button>
</div>
{#if custom}
	<TextField
		label={customLabel}
		placeholder="#e53935"
		hint={$lang('hearth_style_color_hint')}
		error={colorError(value) ? $lang('hearth_style_color_invalid') : undefined}
		bind:value={() => value ?? '', (text) => (value = text as T)}
	/>
{/if}

<style>
	.color-chips {
		margin-top: 0;
	}

	.color-chips .chip {
		background: none;
		font-family: inherit;
	}

	@media (pointer: coarse) {
		.color-chips .chip {
			min-height: var(--h-touch-target);
		}
	}

	.swatch {
		width: 12px;
		height: 12px;
		border-radius: var(--h-radius-pill);
		flex: none;
	}

	.swatch.open {
		border: 1px dashed var(--h-text-5);
	}

	.swatch.faded {
		opacity: 0.5;
	}
</style>
