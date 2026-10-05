<script lang="ts">
	import { integerFromInput } from '../../edit/numbers';
	import FormRenderer from '../../edit/FormRenderer.svelte';
	import { EditorForm, type FormValues } from '../../edit/form.svelte';
	import { ICON } from '../../iconSizes';
	import { lang } from '$lib/core/i18n';
	import { domainDescriptor } from '$lib/core/domains';
	import type { EntityRef } from '../../types';
	import { moveItem } from '../../config';
	import { activateOnKeyboard } from '../../interaction';
	import type { CardEditorProps } from '../types';
	import type { EntitiesCard } from './descriptor';
	import ActionField from '../../edit/ActionField.svelte';
	import CheckField from '../../edit/CheckField.svelte';
	import CodeField from '../../edit/CodeField.svelte';
	import EntityField from '../../edit/EntityField.svelte';
	import EntityPicker from '../../edit/EntityPicker.svelte';
	import Icon from '../../Icon.svelte';
	import IconField from '../../edit/IconField.svelte';
	import SelectField from '../../edit/SelectField.svelte';
	import TextField from '../../edit/TextField.svelte';
	import type { EditableStyleRule } from '../../edit/StyleRulesField.svelte';
	import { normalizeStyleRules } from '../../normalizers';

	let { initial: initialProp, onchange }: CardEditorProps<EntitiesCard> = $props();

	// remounted per target and type, so the initial value is all the form needs
	// svelte-ignore state_referenced_locally
	const initial = initialProp;

	// display widened to string so the per-entity select can hold '' for
	// "follow the card style"; narrowed back to the union when building
	type EditableRef = {
		entity: string;
		name: string;
		icon: string;
		display: string;
		readonly: boolean;
		active_entity: string;
		active_states: string;
		slider_updates: string;
		name_template: string;
		state_template: string;
		// YAML-only field with no form control; carried so edits don't drop it
		verdict?: EntityRef['verdict'];
		tap_action?: EntityRef['tap_action'];
		hold_action?: EntityRef['hold_action'];
		// false while that action's form does not hold a usable action
		tapValid?: boolean;
		holdValid?: boolean;
		styleValid?: boolean;
		style: EditableStyleRule[];
	};

	function editable(ref: EntityRef): EditableRef {
		return {
			entity: ref.entity ?? '',
			name: ref.name ?? '',
			icon: ref.icon ?? '',
			display: ref.display ?? '',
			readonly: ref.readonly ?? false,
			active_entity: ref.active_entity ?? '',
			active_states: ref.active_states?.join(', ') ?? '',
			slider_updates: ref.slider_updates ?? '',
			name_template: ref.name_template ?? '',
			state_template: ref.state_template ?? '',
			verdict: ref.verdict,
			tap_action: ref.tap_action,
			hold_action: ref.hold_action,
			style: (ref.style ?? []).map((rule) => ({
				conditions: structuredClone(rule.conditions),
				color: rule.color ?? '',
				icon: rule.icon ?? '',
				class: rule.class ?? ''
			}))
		};
	}

	const collapsed = (values: FormValues) => values.collapsed === true;
	const form = new EditorForm(initial, [
		{
			key: 'title',
			kind: 'text',
			label: 'hearth_title',
			example: 'hearth_example_entities_title'
		},
		{
			key: 'style',
			kind: 'select',
			label: 'hearth_style',
			default: 'tile',
			options: [
				{ value: 'tile', label: 'hearth_style_tiles' },
				{ value: 'stat', label: 'hearth_style_stat_boxes' }
			]
		},
		{
			key: 'columns',
			kind: 'select',
			options: [
				{ value: '', label: 'auto' }, // copy ok: translation key
				{ value: '1' },
				{ value: '2' },
				{ value: '3' },
				{ value: '4' }
			],
			write: (raw) => {
				const count = integerFromInput(String(raw));
				return Number.isFinite(count) && count >= 1 ? count : undefined;
			}
		},
		{
			key: 'vertical_padding',
			kind: 'select',
			label: 'hearth_vertical_padding',
			advanced: true,
			options: [
				{ value: '', label: 'hearth_standard_density' },
				{ value: 'compact', label: 'hearth_compact' }
			]
		},
		{
			key: 'slider_updates',
			kind: 'select',
			label: 'hearth_slider_updates',
			default: 'continuous',
			advanced: true,
			options: [
				{ value: 'continuous', label: 'hearth_while_dragging' },
				{ value: 'release', label: 'hearth_on_release' }
			],
			// stored even at the default, as it always has been
			write: (raw) => raw
		},
		{
			key: 'show_count',
			kind: 'check',
			label: 'hearth_show_active_count_in_header',
			// mirrors the runtime default (titled sections count unless opted out), so
			// the checkbox state matches what the dashboard actually renders
			read: (card) => (card ? (card.show_count ?? Boolean(card.title)) : true),
			// stored only when it differs from that default; explicit false opts a
			// titled section out
			write: (on, values) => (on === Boolean(String(values.title).trim()) ? undefined : on)
		},
		{
			key: 'group_actions',
			kind: 'check',
			label: 'hearth_header_actions_for_groups_all_off',
			default: true
		},
		{ key: 'tune_button', kind: 'check', label: 'hearth_controls_glyph_on_tiles_long_press' },
		{ key: 'readonly', kind: 'check', label: 'hearth_display_only_no_tile_ever_sends' },
		{
			key: 'wildcard',
			kind: 'text',
			label: 'hearth_entity_wildcard_optional',
			placeholder: 'light.kitchen_*',
			advanced: true
		},
		{ key: 'collapsed', kind: 'check', label: 'hearth_collapse_into_a_summary_row_details' },
		{
			key: 'icon',
			kind: 'icon',
			label: 'hearth_summary_row_icon_optional',
			show: collapsed,
			clearHidden: true
		},
		{
			key: 'summary',
			kind: 'text',
			label: 'hearth_summary_text_optional',
			example: 'hearth_example_entities_summary',
			show: collapsed,
			clearHidden: true
		},
		{
			key: 'summary_entity',
			kind: 'entity',
			label: 'hearth_summary_from_entity_optional',
			hint: 'hearth_without_either_the_row_counts_the',
			show: collapsed,
			clearHidden: true
		}
	]);
	let style = $derived(form.values.style);
	let readonly = $derived(form.values.readonly === true);
	let entities = $state<EditableRef[]>((initial?.entities ?? []).map(editable));
	let entitiesOpen = $state(true);
	let expandedRows = $state<number[]>([]);
	let pickingMany = $state(false);

	/** Applies the preview's drag order to the rows that have an entity. */
	export function applyPreviewReorder(reordered: EntityRef[]) {
		// incomplete rows are filtered out of the preview; keep them in place
		const positions = entities.flatMap((ref, position) => (ref.entity.trim() ? [position] : []));
		if (positions.length !== reordered.length) return;
		const next = entities.map((ref) => ({ ...ref }));
		for (const [order, position] of positions.entries())
			next[position] = editable(reordered[order]);
		entities = next;
		expandedRows = [];
	}

	// light and cover tiles light from their own state, and stat boxes have no
	// highlight, so neither offers the highlight fields
	function highlightable(ref: EditableRef): boolean {
		const domain = ref.entity.trim().split('.')[0];
		return !domainDescriptor(domain).tile && (ref.display || style) !== 'stat';
	}

	function stateList(text: string): string[] | undefined {
		const states = text
			.split(',')
			.map((state) => state.trim())
			.filter(Boolean);
		return states.length ? states : undefined;
	}

	function toggleRow(index: number) {
		expandedRows = expandedRows.includes(index)
			? expandedRows.filter((entry) => entry !== index)
			: [...expandedRows, index];
	}

	function moveRow(index: number, direction: -1 | 1) {
		moveItem(entities, index, direction);
		expandedRows = [];
	}

	function removeRow(index: number) {
		entities.splice(index, 1);
		expandedRows = expandedRows
			.filter((entry) => entry !== index)
			.map((entry) => (entry > index ? entry - 1 : entry));
	}

	function blankRow(entity = ''): EditableRef {
		return {
			entity,
			name: '',
			icon: '',
			display: '',
			readonly: false,
			active_entity: '',
			active_states: '',
			slider_updates: '',
			name_template: '',
			state_template: '',
			style: []
		};
	}

	function addRow() {
		entities.push(blankRow());
		entitiesOpen = true;
		expandedRows = [entities.length - 1];
	}

	function addPicked(entityIds: string[]) {
		entities.push(...entityIds.map((entityId) => blankRow(entityId)));
		entitiesOpen = true;
	}

	let actionsValid = $derived(
		entities.every((ref) => ref.tapValid !== false && ref.holdValid !== false)
	);
	let stylesValid = $derived(entities.every((ref) => ref.styleValid !== false));

	$effect(() => {
		onchange({
			fields: {
				...form.stored,
				entities: entities
					.map((ref): EntityRef => ({
						entity: ref.entity.trim(),
						name: ref.name.trim() || undefined,
						icon: ref.icon.trim() || undefined,
						display: ref.display === 'stat' || ref.display === 'tile' ? ref.display : undefined,
						readonly: ref.readonly || undefined,
						active_entity: highlightable(ref) ? ref.active_entity.trim() || undefined : undefined,
						active_states: highlightable(ref) ? stateList(ref.active_states) : undefined,
						slider_updates:
							ref.slider_updates === 'continuous' || ref.slider_updates === 'release'
								? ref.slider_updates
								: undefined,
						verdict: ref.verdict,
						tap_action: ref.tap_action,
						hold_action: ref.hold_action,
						name_template: ref.name_template.trim() ? ref.name_template : undefined,
						state_template: ref.state_template.trim() ? ref.state_template : undefined,
						style: normalizeStyleRules($state.snapshot(ref.style))
					}))
					.filter((ref) => ref.entity)
			},
			valid: actionsValid && stylesValid,
			// the broken action or rule may sit in a collapsed row, out of sight
			reason: !actionsValid
				? $lang('hearth_action_fix_reason')
				: !stylesValid
					? $lang('hearth_style_rule_fix_reason')
					: undefined
		});
	});
</script>

<FormRenderer {form} />

<button
	type="button"
	class="entities-section-toggle"
	aria-expanded={entitiesOpen}
	onclick={() => (entitiesOpen = !entitiesOpen)}
>
	<span class="group-label">{$lang('hearth_entities')}</span>
	<span class="entities-count">{entities.length}</span>
	<Icon name={entitiesOpen ? 'expand_less' : 'expand_more'} size={ICON.control} />
</button>
{#if entitiesOpen}
	<div class="entity-editors">
		{#each entities as ref, refIndex (refIndex)}
			<div class="filter-row entity-editor-row">
				<div class="entity-row-header">
					<button
						type="button"
						class="entity-row-toggle"
						aria-expanded={expandedRows.includes(refIndex)}
						onclick={() => toggleRow(refIndex)}
					>
						<Icon
							name={expandedRows.includes(refIndex) ? 'expand_more' : 'chevron_right'}
							size={ICON.control}
						/>
						<span class="entity-row-copy">
							<strong>{ref.name.trim() || ref.entity.trim() || $lang('hearth_new_entity')}</strong>
							{#if ref.name.trim() && ref.entity.trim()}<small>{ref.entity}</small>
							{:else if !ref.entity.trim()}<small>{$lang('hearth_empty_row_removed')}</small>{/if}
						</span>
					</button>
					<span class="entity-row-actions">
						<button
							type="button"
							class="reorder"
							disabled={refIndex === 0}
							aria-label={$lang('hearth_move_entity_up')}
							onclick={() => moveRow(refIndex, -1)}
						>
							<Icon name="keyboard_arrow_up" size={ICON.control} />
						</button>
						<button
							type="button"
							class="reorder"
							disabled={refIndex === entities.length - 1}
							aria-label={$lang('hearth_move_entity_down')}
							onclick={() => moveRow(refIndex, 1)}
						>
							<Icon name="keyboard_arrow_down" size={ICON.control} />
						</button>
						<button
							type="button"
							class="remove"
							aria-label={$lang('hearth_remove_entity')}
							onclick={() => removeRow(refIndex)}
						>
							<Icon name="delete" size={ICON.control} />
						</button>
					</span>
				</div>
				{#if expandedRows.includes(refIndex)}
					<div class="filter-fields entity-row-fields">
						<EntityField
							label={$lang('entity')}
							bind:value={ref.entity}
							hint={ref.entity.trim() ? undefined : $lang('hearth_empty_row_removed')}
						/>
						<TextField label={$lang('hearth_name_optional')} bind:value={ref.name} />
						<CodeField
							label={$lang('hearth_name_template_optional')}
							language="jinja2"
							compact
							bind:value={ref.name_template}
							placeholder={"{{ state_attr('sensor.phone', 'friendly_name') }}"}
						/>
						<CodeField
							label={$lang('hearth_state_template_optional')}
							language="jinja2"
							compact
							bind:value={ref.state_template}
							placeholder={"{{ states('sensor.power') | int }} W"}
						/>
						<div class="hint">{$lang('hearth_tile_template_hint')}</div>
						<IconField label={$lang('hearth_icon_optional')} bind:value={ref.icon} />
						{#if highlightable(ref)}
							<EntityField
								label={$lang('hearth_active_while_entity_optional')}
								bind:value={ref.active_entity}
							/>
							<TextField
								label={$lang('hearth_active_states_optional')}
								bind:value={ref.active_states}
								placeholder="running, rinsing, spinning"
							/>
						{/if}
						<SelectField
							label={$lang('hearth_display')}
							bind:value={ref.display}
							options={[
								{ value: '', label: $lang('hearth_card_style') },
								{ value: 'tile', label: $lang('hearth_style_tile') },
								{ value: 'stat', label: $lang('hearth_style_stat_box') }
							]}
						/>
						<SelectField
							label={$lang('hearth_slider_updates')}
							bind:value={ref.slider_updates}
							options={[
								{ value: '', label: $lang('hearth_card_setting') },
								{ value: 'continuous', label: $lang('hearth_while_dragging') },
								{ value: 'release', label: $lang('hearth_on_release') }
							]}
						/>
						{#if !readonly}
							<CheckField label={$lang('hearth_display_only')} bind:checked={ref.readonly} />
						{/if}
						<ActionField
							label={$lang('hearth_tap_action')}
							bind:value={ref.tap_action}
							bind:valid={ref.tapValid}
						/>
						<ActionField
							label={$lang('hearth_hold_action')}
							bind:value={ref.hold_action}
							bind:valid={ref.holdValid}
						/>
						{#await import('../../edit/StyleRulesField.svelte') then StyleRulesField}
							<StyleRulesField.default bind:value={ref.style} bind:valid={ref.styleValid} />
						{/await}
					</div>
				{/if}
			</div>
		{/each}
		<div
			class="add-filter"
			role="button"
			tabindex="0"
			onclick={addRow}
			onkeydown={(event) => activateOnKeyboard(event, addRow)}
		>
			<Icon name="add" size={ICON.control} />
			<span>{$lang('hearth_add_entity')}</span>
		</div>
		<div
			class="add-filter"
			role="button"
			tabindex="0"
			onclick={() => (pickingMany = true)}
			onkeydown={(event) => activateOnKeyboard(event, () => (pickingMany = true))}
		>
			<Icon name="playlist_add" size={ICON.control} />
			<span>{$lang('hearth_pick_several_entities')}</span>
		</div>
	</div>
{/if}

{#if pickingMany}
	<EntityPicker
		multiple
		taken={entities.map((ref) => ref.entity.trim()).filter(Boolean)}
		onselectmany={addPicked}
		onclose={() => (pickingMany = false)}
	/>
{/if}
