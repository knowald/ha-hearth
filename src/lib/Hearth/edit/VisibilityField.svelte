<script lang="ts">
	import { numberFromInput } from './numbers';
	import { ICON } from '../iconSizes';
	import { lang } from '$lib/core/i18n';
	import { activateOnKeyboard } from '../interaction';
	import type { VisibilityCondition } from '../config';
	import Icon from '../Icon.svelte';
	import CheckField from './CheckField.svelte';
	import EntityField from './EntityField.svelte';
	import SelectField from './SelectField.svelte';
	import TextField from './TextField.svelte';
	import VisibilityField from './VisibilityField.svelte';

	let {
		value = $bindable([]),
		nested = false,
		media = true
	}: {
		value?: VisibilityCondition[];
		nested?: boolean;
		/** False leaves out media query conditions, for rules checked outside the page layout. */
		media?: boolean;
	} = $props();

	type RowType = 'entity' | 'numeric' | 'media' | 'or';

	let TYPE_OPTIONS = $derived([
		{ value: 'entity', label: $lang('hearth_entity_state') },
		{ value: 'numeric', label: $lang('hearth_numeric_state') },
		...(media ? [{ value: 'media', label: $lang('hearth_media_query') }] : []),
		// an or-group inside an or-group adds nothing; keep the tree one level deep
		...(nested ? [] : [{ value: 'or', label: $lang('hearth_any_of') }])
	]);

	function rowType(condition: VisibilityCondition): RowType {
		if ('media' in condition) return 'media';
		if ('or' in condition) return 'or';
		return condition.above !== undefined || condition.below !== undefined ? 'numeric' : 'entity';
	}

	function setRowType(index: number, type: string) {
		drafts = {};
		value[index] =
			type === 'media'
				? { media: '' }
				: type === 'or'
					? { or: [{ entity: '', state: '' }] }
					: type === 'numeric'
						? { entity: '', above: 0 }
						: { entity: '', state: '' };
	}

	function entityValue(index: number): string {
		const condition = value[index];
		return 'entity' in condition ? condition.entity : '';
	}

	function setEntity(index: number, entity: string) {
		const condition = value[index];
		if ('entity' in condition) condition.entity = entity;
	}

	// entity conditions collapse `state`/`state_not` into a single text field
	// plus the "must not match" toggle - a row only ever sets one of the two
	function stateValue(index: number): string {
		const condition = value[index];
		return 'entity' in condition ? (condition.state ?? condition.state_not ?? '') : '';
	}

	function isStateNot(index: number): boolean {
		const condition = value[index];
		return 'entity' in condition && condition.state_not !== undefined;
	}

	function setState(index: number, text: string) {
		const condition = value[index];
		if (!('entity' in condition)) return;
		if (isStateNot(index)) condition.state_not = text;
		else condition.state = text;
	}

	function setStateNot(index: number, notMatch: boolean) {
		const condition = value[index];
		if (!('entity' in condition)) return;
		const text = condition.state ?? condition.state_not ?? '';
		delete condition.state;
		delete condition.state_not;
		if (notMatch) condition.state_not = text;
		else condition.state = text;
	}

	// what the user typed, so "-" and "20." survive until the number is complete
	let drafts = $state<Record<string, string>>({});

	function boundValue(index: number, key: 'above' | 'below'): string {
		const draft = drafts[`${index}:${key}`];
		if (draft !== undefined) return draft;
		const condition = value[index];
		const bound = 'entity' in condition ? condition[key] : undefined;
		return typeof bound === 'number' ? String(bound) : '';
	}

	function setBound(index: number, key: 'above' | 'below', text: string) {
		const condition = value[index];
		if (!('entity' in condition)) return;
		const parsed = numberFromInput(text);
		if (Number.isFinite(parsed)) {
			// a complete number renders from the condition; only partial text is kept
			delete drafts[`${index}:${key}`];
			condition[key] = parsed;
		} else {
			drafts[`${index}:${key}`] = text;
			if (!text.trim()) delete condition[key];
		}
	}

	function mediaValue(index: number): string {
		const condition = value[index];
		return 'media' in condition ? condition.media : '';
	}

	function setMedia(index: number, media: string) {
		const condition = value[index];
		if ('media' in condition) condition.media = media;
	}

	function addRow() {
		value.push({ entity: '', state: '' });
	}

	function removeRow(index: number) {
		// drafts are keyed by index; the rows below shift, so none of them may survive
		drafts = {};
		value.splice(index, 1);
	}
</script>

{#if !nested}
	<div class="group-label">{$lang('hearth_visibility')}</div>
{/if}
{#each value as condition, index (index)}
	<div class="visibility-row">
		<div class="visibility-fields">
			<SelectField
				label={$lang('hearth_condition_type')}
				value={rowType(condition)}
				options={TYPE_OPTIONS}
				onchange={(type) => setRowType(index, type)}
			/>
			{#if rowType(condition) === 'entity'}
				<EntityField
					label={$lang('entity')}
					bind:value={() => entityValue(index), (entity) => setEntity(index, entity)}
				/>
				<TextField
					label={$lang('state')}
					placeholder="on"
					bind:value={() => stateValue(index), (state) => setState(index, state)}
				/>
				<CheckField
					label={$lang('hearth_must_not_match')}
					checked={isStateNot(index)}
					onchange={(notMatch) => setStateNot(index, notMatch)}
				/>
			{:else if rowType(condition) === 'numeric'}
				<EntityField
					label={$lang('entity')}
					bind:value={() => entityValue(index), (entity) => setEntity(index, entity)}
				/>
				<TextField
					label={$lang('hearth_above')}
					placeholder="20"
					bind:value={() => boundValue(index, 'above'), (text) => setBound(index, 'above', text)}
				/>
				<TextField
					label={$lang('hearth_below')}
					placeholder="25"
					bind:value={() => boundValue(index, 'below'), (text) => setBound(index, 'below', text)}
				/>
			{:else if rowType(condition) === 'or' && 'or' in condition}
				<div class="hint">{$lang('hearth_any_of_hint')}</div>
				<VisibilityField bind:value={condition.or} nested {media} />
			{:else}
				<TextField
					label={$lang('hearth_media_query')}
					placeholder="(max-width: 900px)"
					bind:value={() => mediaValue(index), (media) => setMedia(index, media)}
				/>
			{/if}
		</div>
		<button
			type="button"
			class="remove"
			aria-label={$lang('hearth_remove_condition')}
			onclick={() => removeRow(index)}
		>
			<Icon name="delete" size={ICON.control} />
		</button>
	</div>
{/each}
<div
	class="add-row"
	onclick={addRow}
	role="button"
	tabindex="0"
	onkeydown={(event) => activateOnKeyboard(event, addRow)}
>
	<Icon name="add" size={ICON.control} />
	<span>{$lang('add_condition')}</span>
</div>

<style>
	.group-label {
		font-family: var(--h-font-mono);
		font-size: var(--h-type-label);
		letter-spacing: 2px;
		text-transform: uppercase;
		color: var(--h-label);
		margin: 18px 0 10px;
	}

	.visibility-row {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 12px 12px 0;
		border-radius: var(--h-radius-sm);
		background: var(--h-inset);
		margin-bottom: 10px;
	}

	.visibility-fields {
		flex: 1;
	}

	.remove {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 0;
		background: none;
		color: var(--h-icon);
		cursor: pointer;
		margin-top: 32px;
	}

	/* a finger-sized button, centered on the first field's input */
	@media (pointer: coarse) {
		.remove {
			min-width: var(--h-touch-target);
			min-height: var(--h-touch-target);
			margin-top: 20px;
		}
	}

	@media (hover: hover) {
		.remove:hover {
			color: var(--h-bad-text);
		}
	}

	.add-row {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 12px;
		border-radius: var(--h-radius-xs);
		border: 1px dashed rgb(var(--h-line-rgb) / calc(0.15 * var(--h-line-scale)));
		color: var(--h-text-4);
		font-size: var(--h-type-body);
		cursor: pointer;
	}

	@media (hover: hover) {
		.add-row:hover {
			color: var(--h-text-3);
		}
	}
</style>
