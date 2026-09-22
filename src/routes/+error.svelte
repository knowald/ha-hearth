<script lang="ts">
	import '@fontsource-variable/hanken-grotesk';
	import { page } from '$app/state';
	import { base, resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { lang, translation } from '$lib/core/i18n';

	// the error page renders without the page load that seeds translations and
	// reads the configured locale, so English is fetched here when nothing is
	// loaded yet; after a client-side navigation the loaded locale stays
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
	<span>{page.status}</span>
	<h1>{title}</h1>
	<a href={resolve('/')}>{$lang('hearth_return_home')}</a>
</main>

<style>
	/* the boot splash's layout and fallbacks (routes/+page.svelte), since
	   theme tokens may never have been injected on this page */
	main {
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 12px;
		width: 100%;
		height: 100dvh;
		padding: 24px;
		background: var(--h-bg-1, #16110c); /* literal ok: fallback if theme tokens are missing */
		color: var(--h-text-1, #f6eee5); /* literal ok: fallback if theme tokens are missing */
		font-family: var(--h-font-ui, 'Hanken Grotesk Variable', sans-serif);
		text-align: center;
	}

	span {
		font-size: var(--h-type-body, 14px);
		color: var(--h-text-4, #a99b8b); /* literal ok: fallback if theme tokens are missing */
	}

	h1 {
		margin: 0;
		font-size: var(--h-type-title, 20px);
		font-weight: 700;
	}

	a {
		margin-top: 4px;
		border: 1px solid rgb(var(--h-accent-rgb, 240 166 61) / calc(0.35 * var(--h-accent-scale, 1)));
		border-radius: var(--h-radius-xs, 12px);
		padding: 10px 18px;
		color: var(--h-accent-text, #f0a63d); /* literal ok: fallback if theme tokens are missing */
		font-weight: 600;
		text-decoration: none;
	}
</style>
