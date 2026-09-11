<script lang="ts">
	import { page } from '$app/state';
	import { base, resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { lang, translation } from '$lib/core/i18n';

	// the error page renders without the page load that seeds translations,
	// so English is fetched here when nothing is loaded yet
	onMount(async () => {
		if (Object.keys($translation).length) return;
		try {
			const response = await fetch(`${base}/translations/en.json`);
			if (response.ok) $translation = await response.json();
		} catch {
			// keys render as themselves until copy arrives
		}
	});

	const title = $derived(
		$lang(page.status === 404 ? 'hearth_page_not_found' : 'hearth_request_failed')
	);
</script>

<svelte:head><title>{page.status} · Hearth</title></svelte:head>
<main>
	<p>{page.status}</p>
	<h1>{title}</h1>
	<a href={resolve('/')}>{$lang('hearth_return_home')}</a>
</main>

<style>
	main {
		max-width: 640px;
		margin: 15vh auto;
		padding: 32px;
		color: var(--h-text-1, #f6eee5);
	}
	a {
		color: var(--h-accent-text, #f0a63d);
	}
</style>
