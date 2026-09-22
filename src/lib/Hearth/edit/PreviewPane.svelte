<script lang="ts">
	import type { Snippet } from 'svelte';
	import { lang } from '$lib/core/i18n';

	let {
		interactive = false,
		actions = undefined,
		children
	}: {
		/** Lets taps reach the preview; otherwise it only shows. */
		interactive?: boolean;
		/** Controls beside the label, such as a reorder toggle. */
		actions?: Snippet;
		children: Snippet;
	} = $props();
</script>

<aside class="pane">
	<div class="heading" class:empty={!actions}>
		<div class="label">{$lang('hearth_live_preview')}</div>
		{@render actions?.()}
	</div>
	<div class="preview" class:interactive>
		{@render children()}
	</div>
</aside>

<style>
	.pane {
		position: sticky;
		top: 0;
		min-width: 0;
		align-self: start;
	}

	.heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 10px;
	}

	.label {
		color: var(--h-label);
		font-family: var(--h-font-mono);
		font-size: var(--h-type-label);
		letter-spacing: 2px;
	}

	.preview {
		max-height: calc(100dvh - 210px);
		padding: 14px;
		margin-bottom: 14px;
		overflow: auto;
		border-radius: var(--h-radius-md);
		background: var(--h-inset);
		pointer-events: none;
	}

	.preview.interactive {
		pointer-events: auto;
	}

	/* see breakpoints.ts */
	@media (max-width: 900px) {
		/* fields first on narrow screens; the preview follows them */
		.pane {
			padding: 12px;
			margin: 12px -12px 0;
			border-top: 1px solid rgb(var(--h-line-rgb) / calc(0.08 * var(--h-line-scale)));
			background: var(--h-sheet-0);
		}

		.label {
			display: none;
		}

		.heading.empty {
			display: none;
		}

		.preview {
			max-height: 30dvh;
			margin-bottom: 0;
		}
	}
</style>
