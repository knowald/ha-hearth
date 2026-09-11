<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children }: { children: Snippet } = $props();
</script>

<svelte:head>
	<meta name="description" content="Hearth — a dashboard for Home Assistant" />
</svelte:head>

{@render children()}

<style>
	:global(html) {
		box-sizing: border-box;
		font-size: 100%;
	}
	:global(body) {
		margin: 0;
		background: var(--h-bg-1, #16110c);
		font-family: var(--h-font-ui, sans-serif);
	}
	:global(*, *::before, *::after) {
		box-sizing: inherit;
	}
</style>
