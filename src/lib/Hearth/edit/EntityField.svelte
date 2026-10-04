<script lang="ts">
	import { ICON } from '../iconSizes';
	import { fill, lang, selectedLanguage } from '$lib/core/i18n';
	import { states } from '$lib/core/ha/entities';
	import Ripple from '$lib/ui/actions/ripple';
	import { PRESS_RIPPLE } from '../config';
	import Icon from '../Icon.svelte';
	import EntityPicker from './EntityPicker.svelte';
	import FieldMessages, { describedBy } from './FieldMessages.svelte';
	import StateLogic from '$lib/ui/StateLogic.svelte';
	import { fitsDeviceClass } from './entityDirectory';

	const uid = $props.id();

	let {
		label,
		value = $bindable(''),
		domains = [],
		deviceClass = undefined,
		required = false,
		hint = undefined,
		error = undefined,
		onchange = undefined
	}: {
		label: string;
		value?: string;
		domains?: string[];
		/** Lists fitting entities first in the suggestions and the picker, such as temperature sensors. */
		deviceClass?: string;
		/** Marks the label and tells assistive tech; the editor decides what blocks Done. */
		required?: boolean;
		hint?: string;
		error?: string | null;
		/** Fires when a value is committed: typed and left, or picked. */
		onchange?: (value: string) => void;
	} = $props();

	let pickerOpen = $state(false);
	// a half-typed id is not worth a warning; it waits for the field to settle
	let typing = $state(false);

	let options = $derived(
		Object.entries($states ?? {})
			.filter(([id]) => domains.length === 0 || domains.includes(id.split('.')[0]))
			.map(([id, entity]) => ({ id, fits: fitsDeviceClass(entity, deviceClass) }))
			.sort((a, b) => Number(b.fits) - Number(a.fits) || a.id.localeCompare(b.id))
			.map((option) => option.id)
	);

	let entityId = $derived(value.trim());
	let entity = $derived(entityId ? $states?.[entityId] : undefined);

	/*
	 * An id Home Assistant does not report, or one from another domain, may
	 * still be what the user means (a device that is offline right now), so
	 * these warn rather than block. Before the first states arrive every id
	 * would look unknown, so nothing is said.
	 */
	let warning = $derived.by(() => {
		if (!entityId || typing || !$states || !Object.keys($states).length) return null;
		if (domains.length && !domains.includes(entityId.split('.')[0])) {
			const names = domains.map((domain) => $lang(`hearth_domain_${domain}`));
			return fill($lang('hearth_entity_wrong_domain'), { domains: domainList(names) });
		}
		if (!entity) return $lang('hearth_entity_not_found');
		return null;
	});

	// "Scene or Script" in the reader's language
	function domainList(names: string[]): string {
		try {
			return new Intl.ListFormat($selectedLanguage || undefined, { type: 'disjunction' }).format(
				names
			);
		} catch {
			// a language tag the browser does not know
			return names.join(', ');
		}
	}

	function commit() {
		typing = false;
		onchange?.(value);
	}
</script>

<div class="field">
	<label class="field-label" class:field-required={required} for="{uid}-input">{label}</label>
	<span class="input-wrap">
		<input
			id="{uid}-input"
			type="text"
			bind:value
			list="entities-{uid}"
			placeholder="entity_id"
			spellcheck="false"
			oninput={() => (typing = true)}
			onchange={commit}
			onblur={() => (typing = false)}
			aria-invalid={error ? true : undefined}
			aria-required={required || undefined}
			aria-describedby={[entity && `${uid}-entity`, describedBy(uid, hint, error, warning)]
				.filter(Boolean)
				.join(' ') || undefined}
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
	{#if entity}
		<span class="entity-details" id="{uid}-entity">
			{#if entity.attributes?.friendly_name}
				<span class="entity-name">{entity.attributes.friendly_name}</span>
			{/if}
			<span class="entity-state"><StateLogic entity_id={entityId} /></span>
		</span>
	{/if}
	<FieldMessages id={uid} {hint} {error} {warning} />
</div>

{#if pickerOpen}
	<EntityPicker
		{domains}
		{deviceClass}
		onselect={(picked) => {
			value = picked;
			typing = false;
			onchange?.(picked);
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

	.entity-details {
		display: flex;
		gap: 10px;
		margin-top: 6px;
		font-size: var(--h-type-small);
		color: var(--h-text-4);
	}

	.entity-name {
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.entity-state {
		flex: none;
		color: var(--h-text-3);
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
			font-size: max(var(--h-input-floor), var(--h-type-secondary));
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
