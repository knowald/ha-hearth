<script module lang="ts">
	import { writable } from 'svelte/store';

	/** The stylesheet's text; setting it restyles the page without a reload. */
	export const customCss = writable('');
</script>

<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';

	onMount(async () => {
		try {
			const response = await fetch(`${base}/_api/custom_css`);
			const data = await response.json();

			if (response.ok) {
				customCss.set(data);
			} else {
				throw new Error(data);
			}
		} catch (error) {
			console.error('Custom CSS', error);
		}
	});

	$effect(() => {
		if (!$customCss.trim()) return;
		const style = document.createElement('style');
		style.id = 'ha-hearth-custom-css';
		style.textContent = $customCss;
		document.head.appendChild(style);
		return () => style.remove();
	});
</script>
