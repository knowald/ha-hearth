<script lang="ts">
	import { settingsSearch } from './search.svelte';

	let { title }: { title: string } = $props();

	const search = settingsSearch();
</script>

<!-- a run of rows inside a section, set off by its own small heading; search
     results drop it, since the matching rows no longer run together -->
{#if !search?.active}<div class="group-title">{title}</div>{/if}

<style>
	.group-title {
		padding: 14px 16px 4px;
		border-top: 1px solid rgb(var(--h-line-rgb) / calc(0.06 * var(--h-line-scale)));
		font-family: var(--h-font-mono);
		font-size: var(--h-type-label);
		letter-spacing: 2px;
		text-transform: uppercase;
		color: var(--h-label);
	}
</style>
