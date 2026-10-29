<script lang="ts">
	import type { Snippet } from 'svelte';

	/*
	 * One titled section of a settings list: the heading, where its values are
	 * kept, and the bordered run of rows the children fill.
	 */
	let {
		title,
		scope,
		clip = false,
		children
	}: {
		title: string;
		scope?: string;
		/** Clips instead of hiding overflow, so a sticky child can still pin. */
		clip?: boolean;
		children: Snippet;
	} = $props();
</script>

<section>
	<div class="section-title">{title}</div>
	{#if scope}<div class="section-scope">{scope}</div>{/if}
	<div class="rows" class:clip>
		{@render children()}
	</div>
</section>

<style>
	.section-title {
		font-family: var(--h-font-mono);
		font-size: var(--h-type-label);
		letter-spacing: 2px;
		text-transform: uppercase;
		color: var(--h-label);
		margin: 0 0 4px;
	}

	.section-scope {
		font-size: var(--h-type-small);
		color: var(--h-text-6);
		margin: 0 0 8px;
	}

	.rows {
		border-radius: var(--h-radius-sm);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.08 * var(--h-line-scale)));
		background: var(--h-track);
		overflow: hidden;
	}

	.rows.clip {
		overflow: clip;
	}
</style>
