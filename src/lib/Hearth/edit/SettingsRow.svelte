<script lang="ts">
	import { tick, type Snippet } from 'svelte';
	import { ICON } from '../iconSizes';
	import Ripple from '$lib/ui/actions/ripple';
	import { focusableIn } from '$lib/ui/layers';
	import { lang } from '$lib/core/i18n';
	import { PRESS_RIPPLE } from '../config';
	import Icon from '../Icon.svelte';
	import { searchMatch } from './settings/search.svelte';

	/*
	 * One line of a settings list. With `onclick` the whole row is a button that
	 * opens something (a chevron says so); without it the row holds its control,
	 * passed as children, in a column beside the label. An inline select or a
	 * child with the wide-control class fills that column.
	 */
	let {
		label,
		sub,
		icon,
		onclick,
		danger = false,
		chevron = true,
		inherit,
		children
	}: {
		label: string;
		sub?: string;
		icon?: string;
		onclick?: () => void;
		danger?: boolean;
		chevron?: boolean;
		/**
		 * A value this screen may take over from a shared one. The tag says
		 * whose value the control shows; while it is this screen's own, a link
		 * under the label hands it back.
		 */
		inherit?: {
			overridden: boolean;
			/** Names where a followed value comes from, such as Dashboard. */
			from: string;
			/** The link that drops this screen's own value, naming the one that returns. */
			reset: string;
			onreset: () => void;
		};
		children?: Snippet;
	} = $props();

	const shown = searchMatch(() => [label, sub]);

	let control = $state<HTMLElement>();

	// the link goes away with the override; focus stays in the row
	async function reset() {
		inherit?.onreset();
		await tick();
		if (control) focusableIn(control)[0]?.focus();
	}
</script>

{#snippet main()}
	<div class="row-main">
		<div class="row-label">{label}</div>
		{#if sub}<div class="row-sub">{sub}</div>{/if}
		{#if inherit?.overridden}
			<button type="button" class="row-reset" onclick={reset}>{inherit.reset}</button>
		{/if}
	</div>
{/snippet}

<!-- the settings sheet's search drops rows that do not match -->
{#if shown()}
	{#if onclick}
		<button
			type="button"
			class="row action pressable"
			class:danger
			use:Ripple={PRESS_RIPPLE}
			{onclick}
		>
			{#if icon}<Icon name={icon} size={ICON.control} />{/if}
			{@render main()}
			{#if chevron}<Icon name="chevron_right" size={ICON.control} />{/if}
		</button>
	{:else}
		<div class="row control">
			{@render main()}
			<div class="row-control" class:own={inherit?.overridden} bind:this={control}>
				{#if inherit}
					<span class="row-tag">
						{inherit.overridden ? $lang('hearth_this_screen') : inherit.from}
					</span>
				{/if}
				{@render children?.()}
			</div>
		</div>
	{/if}
{/if}

<style>
	.row {
		display: flex;
		align-items: center;
		gap: 14px;
		width: 100%;
		box-sizing: border-box;
		padding: 12px 16px;
		min-height: 56px;
		border: 0;
		background: none;
		font: inherit;
		text-align: left;
		color: var(--h-icon);
	}

	/* the label keeps a readable width; the control column takes the rest up to its own */
	.row.control {
		display: grid;
		grid-template-columns: minmax(160px, 1fr) minmax(0, 360px);
		gap: 10px 24px;
		padding: 14px 18px;
	}

	/* rows are separate instances, so the compiler cannot see the sibling */
	:global(.row) + .row {
		border-top: 1px solid rgb(var(--h-line-rgb) / calc(0.06 * var(--h-line-scale)));
	}

	.row-main {
		flex: 1;
		min-width: 0;
	}

	.row-label {
		font-size: var(--h-type-body);
		color: var(--h-text-2);
	}

	.row-sub {
		font-size: var(--h-type-small);
		color: var(--h-text-4);
		margin-top: 2px;
	}

	.row-reset {
		display: inline;
		margin-top: 4px;
		padding: 0;
		border: 0;
		background: none;
		color: var(--h-accent-text);
		font: inherit;
		font-size: var(--h-type-small);
		text-align: left;
		text-decoration: underline;
		text-underline-offset: 2px;
		cursor: pointer;
	}

	.row-control {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 10px;
		min-width: 0;
	}

	.row-control > :global(.wide-control) {
		flex: 1;
		min-width: 0;
	}

	.row-tag {
		flex: none;
		margin-right: auto;
		padding: 2px 6px;
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.16 * var(--h-line-scale)));
		border-radius: var(--h-radius-xs);
		color: var(--h-label);
		font-family: var(--h-font-mono);
		font-size: var(--h-type-label);
		letter-spacing: 1px;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.own .row-tag {
		border-color: transparent;
		background: rgb(var(--h-accent-rgb) / calc(0.16 * var(--h-accent-scale)));
		color: var(--h-accent-text);
	}

	.own :global(select) {
		border-color: rgb(var(--h-accent-rgb) / calc(0.4 * var(--h-accent-scale)));
	}

	.row.action {
		cursor: pointer;
		user-select: none;
		-webkit-user-select: none;
	}

	@media (hover: hover) {
		.row.action:hover {
			background: rgb(var(--h-surface-rgb) / calc(0.04 * var(--h-fill-scale)));
		}
	}

	.row.danger .row-label {
		color: var(--h-bad-text);
	}

	/* a phone-width sheet puts a wide control under its label; a switch or a
	   stepper still fits beside it */
	@media (max-width: 640px) {
		.row.control {
			grid-template-columns: minmax(0, 1fr) auto;
		}

		.row.control:has(.row-tag, .row-control > :global(:is(.inline, .wide-control))) {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
