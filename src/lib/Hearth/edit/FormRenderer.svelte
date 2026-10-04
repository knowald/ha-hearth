<script lang="ts" generics="T">
	import { ICON } from '../iconSizes';
	import { fill, lang } from '$lib/core/i18n';
	import Icon from '../Icon.svelte';
	import CheckField from './CheckField.svelte';
	import CodeField from './CodeField.svelte';
	import EntityField from './EntityField.svelte';
	import IconField from './IconField.svelte';
	import ImageField from './ImageField.svelte';
	import SelectField from './SelectField.svelte';
	import TextField from './TextField.svelte';
	import type { EditorField, EditorForm } from './form.svelte';

	let {
		form,
		onchange = undefined
	}: {
		form: EditorForm<T>;
		/**
		 * Reports the stored fields and Done's verdict, once on mount and on every
		 * change. `never` lets any CardDraft or WidgetDraft callback take it; the
		 * form's fields are that type's own keys.
		 */
		onchange?: (draft: { fields: never; valid: boolean; reason?: string }) => void;
	} = $props();

	// svelte-ignore state_referenced_locally
	let advancedOpen = $state(form.customized);

	let basic = $derived(rows(form.fields.filter((field) => !field.advanced && form.shown(field))));
	let advanced = $derived(rows(form.fields.filter((field) => field.advanced && form.shown(field))));

	// a field marked beside joins the row of the one before it
	function rows(fields: EditorField<T>[]): EditorField<T>[][] {
		const grouped: EditorField<T>[][] = [];
		for (const field of fields) {
			if (field.beside && grouped.length) grouped[grouped.length - 1].push(field);
			else grouped.push([field]);
		}
		return grouped;
	}

	function text(field: EditorField<T>): string {
		return String(form.values[field.key]);
	}

	function set(field: EditorField<T>, value: string | boolean) {
		form.values[field.key] = value;
	}

	function placeholder(field: EditorField<T>): string | undefined {
		if (field.example) return $lang(field.example);
		return typeof field.placeholder === 'function'
			? field.placeholder(form.values)
			: field.placeholder;
	}

	$effect(() => {
		onchange?.({ fields: form.stored as never, ...form.validity });
	});
</script>

{#snippet control(field: EditorField<T>)}
	{@const label = $lang(field.label ?? field.key)}
	{@const hint = field.hint ? $lang(field.hint) : undefined}
	{#if field.kind === 'check'}
		<CheckField
			{label}
			{hint}
			bind:checked={() => form.values[field.key] === true, (next) => set(field, next)}
		/>
	{:else if field.kind === 'select'}
		<SelectField
			{label}
			{hint}
			bind:value={() => text(field), (next) => set(field, next)}
			options={(field.options ?? []).map((option) => ({
				value: option.value,
				label: option.label ? fill($lang(option.label), option.params ?? {}) : option.value
			}))}
		/>
	{:else if field.kind === 'entity'}
		<EntityField
			{label}
			{hint}
			required={field.required}
			domains={field.domains}
			deviceClass={field.deviceClass}
			bind:value={() => text(field), (next) => set(field, next)}
		/>
	{:else if field.kind === 'image'}
		<ImageField
			{label}
			{hint}
			placeholder={placeholder(field)}
			bind:value={() => text(field), (next) => set(field, next)}
		/>
	{:else if field.kind === 'icon'}
		<IconField
			{label}
			placeholder={placeholder(field)}
			bind:value={() => text(field), (next) => set(field, next)}
		/>
		{#if hint}<div class="hint">{hint}</div>{/if}
	{:else if field.kind === 'code'}
		<CodeField
			{label}
			required={field.required}
			language={field.language}
			expectMapping={field.expectMapping}
			placeholder={placeholder(field)}
			bind:value={() => text(field), (next) => set(field, next)}
		/>
		{#if hint}<div class="hint">{hint}</div>{/if}
	{:else}
		{@const issue = form.issue(field)}
		<TextField
			{label}
			{hint}
			required={field.required}
			inputmode={field.inputmode}
			placeholder={placeholder(field)}
			error={issue ? $lang(issue) : undefined}
			bind:value={() => text(field), (next) => set(field, next)}
		/>
	{/if}
{/snippet}

{#snippet group(fieldRows: EditorField<T>[][])}
	{#each fieldRows as row (row[0].key)}
		{#if row.length > 1}
			<div class="row">
				<div class="grow">{@render control(row[0])}</div>
				{#each row.slice(1) as field (field.key)}
					<div class="icon-column">{@render control(field)}</div>
				{/each}
			</div>
		{:else}
			{@render control(row[0])}
		{/if}
	{/each}
{/snippet}

{@render group(basic)}
{#if advanced.length}
	<button
		type="button"
		class="entities-section-toggle"
		aria-expanded={advancedOpen}
		onclick={() => (advancedOpen = !advancedOpen)}
	>
		<span class="group-label">{$lang('hearth_advanced')}</span>
		<Icon name={advancedOpen ? 'expand_less' : 'expand_more'} size={ICON.control} />
	</button>
	{#if advancedOpen}
		{@render group(advanced)}
	{/if}
{/if}
