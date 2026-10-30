<script lang="ts">
	import type { Snippet } from 'svelte';
	import { searchMatch } from './search.svelte';

	/*
	 * Hides a settings item that is not a SettingsRow (an entity field, a page)
	 * while the sheet's search does not match its text.
	 */
	let { text, children }: { text: readonly (string | undefined)[]; children: Snippet } = $props();

	const shown = searchMatch(() => text);
</script>

{#if shown()}{@render children()}{/if}
