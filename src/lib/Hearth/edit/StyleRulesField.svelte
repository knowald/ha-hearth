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
	import { activateOnKeyboard } from '../interaction';
	import Icon from '../Icon.svelte';
	import IconField from './IconField.svelte';
	import TextField from './TextField.svelte';
	import VisibilityField from './VisibilityField.svelte';

	let { value = $bindable([]) }: { value?: EditableStyleRule[] } = $props();

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
				bind:value={rule.color}
			/>
			<IconField label={$lang('hearth_icon_optional')} bind:value={rule.icon} />
			<TextField label={$lang('hearth_css_class')} placeholder="unlocked" bind:value={rule.class} />
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
