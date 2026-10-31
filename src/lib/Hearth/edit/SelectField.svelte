<script lang="ts">
	import { ICON } from '../iconSizes';
	import Icon from '../Icon.svelte';
	import FieldMessages, { describedBy } from './FieldMessages.svelte';

	const uid = $props.id();

	let {
		label,
		value = $bindable(''),
		options,
		onchange,
		inline = false,
		hint = undefined,
		error = undefined
	}: {
		label: string;
		value?: string;
		options: { value: string; label: string }[];
		onchange?: (value: string) => void;
		/** Sit beside a settings row's label: the label becomes the accessible name only. */
		inline?: boolean;
		/** Not shown inline, where the settings row carries the explanation. */
		hint?: string;
		error?: string | null;
	} = $props();
</script>

{#snippet select(accessibleName?: string)}
	<select
		aria-label={accessibleName}
		aria-invalid={error ? true : undefined}
		aria-describedby={inline ? undefined : describedBy(uid, hint, error)}
		bind:value
		onchange={() => onchange?.(value)}
	>
		{#each options as option (option.value)}
			<option value={option.value}>{option.label}</option>
		{/each}
	</select>
{/snippet}

{#if inline}
	<span class="inline">
		{@render select(label)}
		<Icon name="expand_more" size={ICON.control} />
	</span>
{:else}
	<div class="field">
		<label>
			<span class="field-label">{label}</span>
			{@render select()}
		</label>
		<FieldMessages id={uid} {hint} {error} />
	</div>
{/if}

<style>
	.field {
		display: block;
		margin-bottom: 14px;
	}

	label {
		display: block;
	}

	.field-label {
		display: block;
		font-family: var(--h-font-mono);
		font-size: var(--h-type-label);
		letter-spacing: 2px;
		text-transform: uppercase;
		color: var(--h-label);
		margin-bottom: 6px;
	}

	select {
		width: 100%;
		padding: 12px 14px;
		border-radius: var(--h-radius-xs);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.1 * var(--h-line-scale)));
		background: var(--h-track);
		color: var(--h-text-2);
		font-family: inherit;
		font-size: var(--h-type-body);
		outline: none;
		appearance: none;
	}

	select:focus {
		border-color: rgb(var(--h-accent-rgb) / calc(0.4 * var(--h-accent-scale)));
	}

	/* iOS Safari zooms the page into any input set under 16px */
	@media (pointer: coarse) {
		select {
			font-size: max(var(--h-input-floor), var(--h-type-body));
		}
	}

	option {
		background: var(--h-sheet-0);
	}

	.inline {
		position: relative;
		display: flex;
		align-items: center;
		flex: 1;
		min-width: 0;
		color: var(--h-icon);
	}

	.inline :global(.mi) {
		position: absolute;
		right: 8px;
		pointer-events: none;
	}

	/* fills the settings row's control column, so the edges in a list line up */
	.inline select {
		width: 100%;
		padding: 8px 32px 8px 12px;
		background: rgb(var(--h-surface-rgb) / calc(0.06 * var(--h-fill-scale)));
		cursor: pointer;
	}
</style>
