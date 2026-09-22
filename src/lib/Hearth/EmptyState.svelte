<script lang="ts">
	import { ICON } from './iconSizes';
	import Icon from './Icon.svelte';

	/**
	 * One look for "nothing here": a dashed frame with an optional icon, a
	 * line of copy and an optional hint. `inline` drops the frame for lists
	 * and panels that already have a border of their own. `action` adds one
	 * button for the way out of the empty state.
	 */
	let {
		text,
		hint = undefined,
		icon = undefined,
		inline = false,
		action = undefined
	}: {
		text: string;
		hint?: string;
		icon?: string;
		inline?: boolean;
		action?: { label: string; onclick: () => void };
	} = $props();
</script>

<div class="empty-state" class:inline class:actionable={action} role="status">
	{#if icon}<Icon name={icon} size={ICON.control} />{/if}
	<div class="copy">
		<span class="text">{text}</span>
		{#if hint}<span class="hint">{hint}</span>{/if}
	</div>
	{#if action}
		<button type="button" class="action pressable" onclick={action.onclick}>{action.label}</button>
	{/if}
</div>

<style>
	.empty-state {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		padding: 18px;
		border-radius: var(--h-radius-sm);
		border: 1px dashed rgb(var(--h-line-rgb) / calc(0.15 * var(--h-line-scale)));
		color: var(--h-text-6);
		font-size: var(--h-type-secondary);
		text-align: center;
	}

	/* on a phone the button drops below the copy instead of squeezing it */
	.empty-state.actionable {
		flex-wrap: wrap;
	}

	.empty-state.inline {
		justify-content: flex-start;
		padding: 8px;
		border: 0;
		text-align: left;
	}

	.copy {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.hint {
		font-size: var(--h-type-small);
		color: var(--h-text-6);
	}

	.action {
		flex: none;
		padding: 8px 14px;
		border: 0;
		border-radius: var(--h-radius-xs);
		background: linear-gradient(135deg, var(--h-accent-deep), var(--h-accent-bright));
		color: var(--h-on-accent);
		font-family: inherit;
		font-size: var(--h-type-secondary);
		font-weight: 600;
		cursor: pointer;
	}
</style>
