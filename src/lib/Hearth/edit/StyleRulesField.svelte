<script lang="ts" module>
	import type { VisibilityCondition } from '../config';

	/** A style rule as the form holds it: every text field present, maybe blank. */
	export interface EditableStyleRule {
		conditions: VisibilityCondition[];
		color: string;
		icon: string;
		class: string;
	}
</script>

<script lang="ts">
	import { ICON } from '../iconSizes';
	import { fill, lang } from '$lib/core/i18n';
	import { classListProblem } from '../config';
	import { activateOnKeyboard } from '../interaction';
	import { normalizeStyleRules } from '../normalizers';
	import { styleColor } from '../visibility';
	import Icon from '../Icon.svelte';
	import IconField from './IconField.svelte';
	import TextField from './TextField.svelte';
	import VisibilityField from './VisibilityField.svelte';

	let {
		value = $bindable([]),
		valid = $bindable()
	}: {
		value?: EditableStyleRule[];
		/** False while a rule would be dropped or changed on save; the sheet blocks Done. */
		valid?: boolean;
	} = $props();

	function colorError(rule: EditableStyleRule): string | undefined {
		return rule.color.trim() && !styleColor(rule.color)
			? $lang('hearth_style_color_invalid')
			: undefined;
	}

	function classError(rule: EditableStyleRule): string | undefined {
		if (!rule.class.trim()) return undefined;
		const problem = classListProblem(rule.class);
		return problem === 'format'
			? $lang('hearth_css_class_invalid')
			: problem === 'reserved'
				? $lang('hearth_css_class_reserved')
				: undefined;
	}

	function ruleError(rule: EditableStyleRule): string | undefined {
		if (!rule.color.trim() && !rule.icon.trim() && !rule.class.trim())
			return $lang('hearth_style_rule_needs_change');
		// what saving keeps of the rule's conditions, with a placeholder change
		const kept = normalizeStyleRules([
			{ conditions: $state.snapshot(rule.conditions), class: 'check' }
		]);
		return kept ? undefined : $lang('hearth_style_rule_needs_condition');
	}

	$effect(() => {
		valid = value.every((rule) => !colorError(rule) && !classError(rule) && !ruleError(rule));
	});

	function addRule() {
		value.push({ conditions: [{ entity: '', state: '' }], color: '', icon: '', class: '' });
	}

	function removeRule(index: number) {
		value.splice(index, 1);
	}
</script>

<div class="group-label">{$lang('hearth_style_rules')}</div>
<div class="hint">{$lang('hearth_style_rules_hint')}</div>
{#each value as rule, index (index)}
	<div class="filter-row style-rule">
		<div class="filter-fields">
			<div class="rule-head">
				<span>{fill($lang('hearth_style_rule_number'), { number: index + 1 })}</span>
				<button
					type="button"
					class="remove"
					aria-label={$lang('hearth_remove_style_rule')}
					onclick={() => removeRule(index)}
				>
					<Icon name="delete" size={ICON.control} />
				</button>
			</div>
			<VisibilityField bind:value={rule.conditions} nested media={false} />
			<TextField
				label={$lang('hearth_style_color')}
				placeholder="bad"
				hint={$lang('hearth_style_color_hint')}
				error={colorError(rule)}
				bind:value={rule.color}
			/>
			<IconField label={$lang('hearth_icon_optional')} bind:value={rule.icon} />
			<TextField
				label={$lang('hearth_css_class')}
				placeholder="unlocked"
				error={classError(rule)}
				bind:value={rule.class}
			/>
			{#if ruleError(rule)}
				<div class="field-error" role="alert">{ruleError(rule)}</div>
			{/if}
		</div>
	</div>
{/each}
<div
	class="add-filter"
	role="button"
	tabindex="0"
	onclick={addRule}
	onkeydown={(event) => activateOnKeyboard(event, addRule)}
>
	<Icon name="add" size={ICON.control} />
	<span>{$lang('hearth_add_style_rule')}</span>
</div>

<style>
	.style-rule {
		margin-bottom: 10px;
	}

	.rule-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
		color: var(--h-text-3);
		font-size: var(--h-type-secondary);
	}
</style>
