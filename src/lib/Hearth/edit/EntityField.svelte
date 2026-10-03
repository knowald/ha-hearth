<script lang="ts">
	import { ICON } from '../iconSizes';
	import { lang } from '$lib/core/i18n';
	import { states } from '$lib/core/ha/entities';
	import Ripple from '$lib/ui/actions/ripple';
	import { PRESS_RIPPLE } from '../config';
	import Icon from '../Icon.svelte';
	import EntityPicker from './EntityPicker.svelte';
	import FieldMessages, { describedBy } from './FieldMessages.svelte';

	const uid = $props.id();

	let {
		label,
		value = $bindable(''),
		domains = [],
		hint = undefined,
		error = undefined,
		onchange = undefined
	}: {
		label: string;
		value?: string;
		domains?: string[];
		hint?: string;
		error?: string | null;
		/** Fires when a value is committed: typed and left, or picked. */
		onchange?: (value: string) => void;
	} = $props();

	let pickerOpen = $state(false);

	let options = $derived(
		Object.keys($states ?? {})
			.filter((id) => domains.length === 0 || domains.includes(id.split('.')[0]))
			.sort()
	);
</script>

<div class="field">
	<label class="field-label" for="{uid}-input">{label}</label>
	<span class="input-wrap">
		<input
			id="{uid}-input"
			type="text"
			bind:value
			list="entities-{uid}"
			placeholder="entity_id"
			spellcheck="false"
			onchange={() => onchange?.(value)}
			aria-invalid={error ? true : undefined}
			aria-describedby={describedBy(uid, hint, error)}
		/>
		<button
			type="button"
			class="search pressable"
			aria-label={$lang('hearth_choose_entity')}
			use:Ripple={PRESS_RIPPLE}
			onclick={() => (pickerOpen = true)}
		>
			<Icon name="search" size={ICON.control} />
		</button>
	</span>
	<datalist id="entities-{uid}">
		{#each options as option (option)}
			<option value={option}>{$states?.[option]?.attributes?.friendly_name ?? ''}</option>
		{/each}
	</datalist>
	<FieldMessages id={uid} {hint} {error} />
</div>

{#if pickerOpen}
	<EntityPicker
		{domains}
		onselect={(entityId) => {
			value = entityId;
			onchange?.(entityId);
		}}
		onclose={() => (pickerOpen = false)}
	/>
{/if}

<style>
	.field {
		display: block;
		margin-bottom: 14px;
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

	.input-wrap {
		position: relative;
		display: block;
	}

	input {
		width: 100%;
		padding: 12px 40px 12px 14px;
		border-radius: var(--h-radius-xs);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.1 * var(--h-line-scale)));
		background: var(--h-track);
		color: var(--h-text-2);
		font-family: var(--h-font-mono);
		font-size: var(--h-type-secondary);
		outline: none;
	}

	/* iOS Safari zooms the page into any input set under 16px */
	@media (pointer: coarse) {
		input {
			font-size: max(16px, var(--h-type-secondary)); /* literal ok: the iOS no-zoom floor */
		}
	}

	input:focus {
		border-color: rgb(var(--h-accent-rgb) / calc(0.4 * var(--h-accent-scale)));
	}

	input::placeholder {
		color: var(--h-text-6);
	}

	/* centered via auto margins, not translateY - the global .pressable:active
	   transform would override a transform-based centering */
	.search {
		position: absolute;
		right: 6px;
		top: 0;
		bottom: 0;
		height: 30px;
		margin: auto 0;
		display: flex;
		align-items: center;
		padding: 6px;
		border: 0;
		border-radius: var(--h-radius-xs);
		background: none;
		color: var(--h-icon);
		cursor: pointer;
	}

	/* a finger-sized button; the input's right padding keeps text clear of it */
	@media (pointer: coarse) {
		.search {
			right: 0;
			height: auto;
			min-width: var(--h-touch-target);
			justify-content: center;
		}

		input {
			padding-right: var(--h-touch-target);
		}
	}

	@media (hover: hover) {
		.search:hover {
			color: var(--h-text-3);
		}
	}
</style>
