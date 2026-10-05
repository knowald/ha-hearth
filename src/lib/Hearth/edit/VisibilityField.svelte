<script lang="ts">
	import { numberFromInput } from './numbers';
	import { ICON } from '../iconSizes';
	import { lang, selectedLanguage } from '$lib/core/i18n';
	import { activateOnKeyboard } from '../interaction';
	import { CLOCK_TIME, WEEKDAYS, type VisibilityCondition, type Weekday } from '../config';
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

	type RowType = 'entity' | 'numeric' | 'attribute' | 'device' | 'time' | 'media' | 'or';

	let TYPE_OPTIONS = $derived([
		{ value: 'entity', label: $lang('hearth_entity_state') },
		{ value: 'numeric', label: $lang('hearth_numeric_state') },
		{ value: 'attribute', label: $lang('hearth_entity_attribute') },
		{ value: 'device', label: $lang('hearth_this_device') },
		{ value: 'time', label: $lang('hearth_time_of_day') },
		...(media ? [{ value: 'media', label: $lang('hearth_media_query') }] : []),
		// an or-group inside an or-group adds nothing; keep the tree one level deep
		...(nested ? [] : [{ value: 'or', label: $lang('hearth_any_of') }])
	]);

	function rowType(condition: VisibilityCondition): RowType {
		if ('media' in condition) return 'media';
		if ('or' in condition) return 'or';
		if ('device' in condition) return 'device';
		if ('time' in condition) return 'time';
		if (condition.attribute !== undefined) return 'attribute';
		return condition.above !== undefined || condition.below !== undefined ? 'numeric' : 'entity';
	}

	function setRowType(index: number, type: string) {
		drafts = {};
		value[index] =
			type === 'media'
				? { media: '' }
				: type === 'or'
					? { or: [{ entity: '', state: '' }] }
					: type === 'device'
						? { device: '' }
						: type === 'time'
							? { time: {} }
							: type === 'attribute'
								? { entity: '', attribute: '', state: '' }
								: type === 'numeric'
									? { entity: '', above: 0 }
									: { entity: '', state: '' };
	}

	function attributeValue(index: number): string {
		const condition = value[index];
		return 'entity' in condition ? (condition.attribute ?? '') : '';
	}

	function setAttribute(index: number, attribute: string) {
		const condition = value[index];
		if ('entity' in condition) condition.attribute = attribute;
	}

	// a list is shown and typed as comma-separated names; saving splits it again
	function deviceValue(index: number): string {
		const condition = value[index];
		if (!('device' in condition)) return '';
		return Array.isArray(condition.device) ? condition.device.join(', ') : condition.device;
	}

	function setDevice(index: number, names: string) {
		const condition = value[index];
		if ('device' in condition) condition.device = names;
	}

	function timeValue(index: number, key: 'after' | 'before'): string {
		const condition = value[index];
		return 'time' in condition ? (condition.time[key] ?? '') : '';
	}

	function setTime(index: number, key: 'after' | 'before', text: string) {
		const condition = value[index];
		if (!('time' in condition)) return;
		if (text.trim()) condition.time[key] = text.trim();
		else delete condition.time[key];
	}

	function timeError(index: number, key: 'after' | 'before'): string | undefined {
		const text = timeValue(index, key);
		return text && !CLOCK_TIME.test(text) ? $lang('hearth_time_format') : undefined;
	}

	function hasWeekday(index: number, day: Weekday): boolean {
		const condition = value[index];
		return 'time' in condition && (condition.time.weekdays ?? []).includes(day);
	}

	function toggleWeekday(index: number, day: Weekday) {
		const condition = value[index];
		if (!('time' in condition)) return;
		const before = condition.time.weekdays ?? [];
		const weekdays = WEEKDAYS.filter((entry) =>
			entry === day ? !before.includes(entry) : before.includes(entry)
		);
		if (weekdays.length) condition.time.weekdays = weekdays;
		else delete condition.time.weekdays;
	}

	// 2024-01-01 was a Monday, the first day in WEEKDAYS
	let weekdayNames = $derived(
		WEEKDAYS.map((_, offset) =>
			new Date(2024, 0, 1 + offset).toLocaleDateString($selectedLanguage || undefined, {
				weekday: 'short'
			})
		)
	);

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
			{:else if rowType(condition) === 'attribute'}
				<EntityField
					label={$lang('entity')}
					bind:value={() => entityValue(index), (entity) => setEntity(index, entity)}
				/>
				<TextField
					label={$lang('hearth_attribute')}
					placeholder="hvac_action"
					bind:value={() => attributeValue(index), (text) => setAttribute(index, text)}
				/>
				<TextField
					label={$lang('state')}
					placeholder="heating"
					bind:value={() => stateValue(index), (state) => setState(index, state)}
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
			{:else if rowType(condition) === 'device'}
				<TextField
					label={$lang('hearth_device_names')}
					placeholder="kitchen, hallway"
					hint={$lang('hearth_device_names_hint')}
					bind:value={() => deviceValue(index), (names) => setDevice(index, names)}
				/>
			{:else if rowType(condition) === 'time'}
				<TextField
					label={$lang('hearth_after')}
					placeholder="22:00"
					error={timeError(index, 'after')}
					bind:value={() => timeValue(index, 'after'), (text) => setTime(index, 'after', text)}
				/>
				<TextField
					label={$lang('hearth_before')}
					placeholder="06:00"
					error={timeError(index, 'before')}
					bind:value={() => timeValue(index, 'before'), (text) => setTime(index, 'before', text)}
				/>
				<div class="weekdays" role="group" aria-label={$lang('hearth_weekdays')}>
					{#each WEEKDAYS as day, dayIndex (day)}
						<button
							type="button"
							class="weekday"
							aria-pressed={hasWeekday(index, day)}
							onclick={() => toggleWeekday(index, day)}
						>
							{weekdayNames[dayIndex]}
						</button>
					{/each}
				</div>
				<div class="hint">{$lang('hearth_time_hint')}</div>
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

	.weekdays {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 12px;
	}

	.weekday {
		min-width: 44px;
		min-height: 36px;
		padding: 0 10px;
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.12 * var(--h-line-scale)));
		border-radius: var(--h-radius-pill);
		background: none;
		color: var(--h-text-4);
		font: inherit;
		font-size: var(--h-type-secondary);
		cursor: pointer;
	}

	@media (pointer: coarse) {
		.weekday {
			min-width: var(--h-touch-target);
			min-height: var(--h-touch-target);
		}
	}

	.weekday[aria-pressed='true'] {
		background: rgb(var(--h-accent-rgb) / calc(0.16 * var(--h-accent-scale)));
		border-color: rgb(var(--h-accent-rgb) / calc(0.4 * var(--h-accent-scale)));
		color: var(--h-accent-text);
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
