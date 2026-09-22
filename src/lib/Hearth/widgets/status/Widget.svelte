<script lang="ts">
	import { lang, fill } from '$lib/core/i18n';
	import { ICON } from '../../iconSizes';
	import { entityAvailable, states } from '$lib/core/ha/entities';
	import { hearthConfig, hearthEditMode } from '../../store';
	import { openEntityDetail } from '$lib/Hearth/details';
	import { attentionItems } from '../../attention';
	import Icon from '../../Icon.svelte';

	import type { StatusWidget } from './descriptor';

	let { widget }: { widget: StatusWidget } = $props();
	let icon = $derived(widget.icon ?? 'eco');
	let text = $derived(widget.text);
	let entity = $derived(widget.entity);

	let stateObj = $derived(entity ? $states?.[entity] : undefined);
	let entityState = $derived(stateObj?.state);
	let unavailable = $derived(!!entity && !entityAvailable(stateObj));
	let reading = $derived(
		unavailable
			? '-'
			: entityState !== undefined
				? `${entityState.charAt(0).toUpperCase()}${entityState.slice(1)}`
				: ''
	);
	let label = $derived([text, reading].filter(Boolean).join(' '));

	// without configured content the widget reports actual unresolved conditions;
	// nothing unresolved renders as nothing, not as a nominal platitude
	let autoMode = $derived(!text && !entity);
	let attention = $derived(autoMode ? attentionItems($hearthConfig, $states) : []);
</script>

{#if autoMode}
	{#each attention as item (item.entity)}
		<div class="attention-row">
			<Icon name="cloud_off" size={ICON.control} color="var(--h-accent-dim-text)" />
			<div class="attention-copy">
				<div class="attention-title">
					{fill($lang('hearth_entity_offline'), { name: item.name })}
				</div>
				<div class="attention-detail">{item.detail}</div>
			</div>
		</div>
	{:else}
		{#if $hearthEditMode}
			<div class="status-pill inactive">
				<Icon name={icon} size={ICON.control} color="var(--h-icon)" />
				<span class="pill-text">{$lang('hearth_status_all_clear')}</span>
			</div>
		{/if}
	{/each}
{:else}
	{#snippet content()}
		<Icon name={icon} size={ICON.control} color={unavailable ? 'var(--h-icon)' : 'var(--h-good)'} />
		<span class="pill-text">{label}</span>
	{/snippet}
	{#if stateObj}
		<button
			type="button"
			class="status-pill pressable"
			onclick={() => openEntityDetail(stateObj.entity_id)}
		>
			{@render content()}
		</button>
	{:else}
		<div class="status-pill">{@render content()}</div>
	{/if}
{/if}

<style>
	.status-pill {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 14px 16px;
		border-radius: var(--h-radius-sm);
		background: rgb(var(--h-surface-rgb) / calc(0.04 * var(--h-fill-scale)));
		backdrop-filter: var(--h-surface-blur);
		box-shadow: var(--h-card-shadow);
		width: 100%;
		border: 0;
		font: inherit;
		text-align: left;
	}

	button.status-pill {
		cursor: pointer;
	}

	.status-pill.inactive {
		opacity: 0.45;
	}

	.pill-text {
		font-size: var(--h-type-secondary);
		color: var(--h-text-4);
	}

	.attention-row {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 16px;
		border-radius: var(--h-radius-sm);
		background: rgb(var(--h-accent-rgb) / calc(0.08 * var(--h-accent-scale)));
		border: 1px solid rgb(var(--h-accent-rgb) / calc(0.2 * var(--h-accent-scale)));
		margin-bottom: 8px;
	}

	.attention-copy {
		flex: 1;
		min-width: 0;
	}

	.attention-title {
		font-size: var(--h-type-body);
		font-weight: 600;
		color: var(--h-accent-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.attention-detail {
		font-size: var(--h-type-small);
		color: var(--h-accent-dim-text);
		margin-top: 2px;
	}
</style>
