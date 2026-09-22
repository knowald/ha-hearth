<script lang="ts">
	import { browser } from '$app/environment';
	import { base } from '$app/paths';
	import '@fontsource-variable/geist-mono';
	import '@fontsource-variable/hanken-grotesk';
	import '@material-symbols/font-400/rounded.css';
	import { onDestroy } from 'svelte';
	import { configuration } from '$lib/core/app/configuration';
	import { disposeHaptics, haptics, startPressFeedback } from '$lib/core/app/haptics';
	import { motion } from '$lib/core/app/motion';
	import { connected, tokenNeeded } from '$lib/core/ha/connection';
	import { lang, selectedLanguage, translation } from '$lib/core/i18n';
	import { states } from '$lib/core/ha/entities';
	import { startConnection, stopConnection } from '$lib/core/ha/connection';
	import { setCommandGate } from '$lib/core/ha/commands';
	import { get } from 'svelte/store';
	import TokenPrompt from '$lib/Hearth/TokenPrompt.svelte';
	import ThemeStyle from '$lib/Hearth/shell/ThemeStyle.svelte';
	import { normalizeHearthConfig } from '$lib/Hearth/normalize';
	import {
		hearthConfig,
		hearthLoadError,
		hearthNeedsSetup,
		hearthRevision,
		hearthEditMode
	} from '$lib/Hearth/store';
	import HearthDashboard from '$lib/Hearth/HearthDashboard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let tokenPromptOpen = $state(false);
	// opens once when a token becomes necessary; the boot screen button reopens it after a dismiss
	$effect(() => {
		if ($tokenNeeded) tokenPromptOpen = true;
	});

	// one-time store seeding; `data` only changes on a full page load
	// svelte-ignore state_referenced_locally
	$configuration = data?.configuration;
	// svelte-ignore state_referenced_locally
	$hearthConfig = normalizeHearthConfig(data?.hearth);
	// svelte-ignore state_referenced_locally
	$hearthLoadError = data?.hearthError ?? null;
	// svelte-ignore state_referenced_locally
	$hearthNeedsSetup = data?.hearthNeedsSetup ?? false;
	// svelte-ignore state_referenced_locally
	$hearthRevision = data?.hearthRevision ?? 0;
	// svelte-ignore state_referenced_locally
	$translation = data?.translations ?? {};
	// svelte-ignore state_referenced_locally
	$selectedLanguage = data?.configuration?.locale || 'en';
	if (browser) document.documentElement.lang = $selectedLanguage;

	// motion:false in configuration.yaml disables transitions app-wide, and so
	// does the OS reduced-motion setting unless motion is explicitly true
	const reducedMotion = browser && matchMedia('(prefers-reduced-motion: reduce)').matches;
	// svelte-ignore state_referenced_locally
	if (
		data?.configuration?.motion === false ||
		(reducedMotion && data?.configuration?.motion !== true)
	) {
		motion.set(0);
	}

	// svelte-ignore state_referenced_locally
	haptics.set(data?.configuration?.haptics === true);
	const stopPressFeedback = browser ? startPressFeedback() : undefined;

	if (browser) startConnection($configuration);

	// reconnect when a long-lived access token is entered
	$effect(() => {
		if ($configuration?.token && browser) startConnection($configuration);
	});

	// taps arrange cards while the layout editor is open and must not reach a device
	setCommandGate(() => !get(hearthEditMode));
	onDestroy(() => {
		stopConnection();
		stopPressFeedback?.();
		disposeHaptics();
		setCommandGate(() => true);
	});
</script>

<svelte:head>
	<!-- eslint-disable-next-line hearth/no-bare-text -- product name, not copy -->
	<title>Hearth</title>
	<link rel="manifest" href="{base}/hearth.webmanifest" />
	<meta name="theme-color" content="#16110c" />
</svelte:head>

{#if $states}
	<HearthDashboard />
{:else}
	<ThemeStyle />
	{#if $configuration?.hassUrl}
		<section class="boot" aria-live="polite" aria-busy={!$tokenNeeded}>
			<div class="boot-mark" aria-hidden="true"></div>
			<strong>
				{$lang(
					$connected ? 'hearth_loading_home_assistant' : 'hearth_connecting_to_home_assistant'
				)}
			</strong>
			<span>{$lang('hearth_appears_after_first_snapshot')}</span>
			{#if $tokenNeeded}
				<button type="button" onclick={() => (tokenPromptOpen = true)}>{$lang('login')}</button>
			{/if}
		</section>
	{:else}
		<section class="boot" role="alert">
			<strong>{$lang('hearth_hass_url_missing')}</strong>
			<span>{$lang('hearth_hass_url_missing_hint')}</span>
		</section>
	{/if}
{/if}

{#if tokenPromptOpen}<TokenPrompt onclose={() => (tokenPromptOpen = false)} />{/if}

<!-- modules -->
{#if $configuration?.custom_js}
	{#await import('$lib/ui/CustomJs.svelte') then CustomJs}
		<CustomJs.default />
	{/await}
{/if}

<!-- custom css -->
{#await import('$lib/ui/CustomCss.svelte') then CustomCss}
	<CustomCss.default />
{/await}

<style>
	.boot {
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 12px;
		width: 100%;
		height: 100dvh;
		padding: 24px;
		/* the boot splash shows before ThemeStyle mounts, so no tokens exist yet */
		background: #16110c; /* literal ok: pre-theme boot splash */
		color: #f6eee5; /* literal ok: pre-theme boot splash */
		font-family: 'Hanken Grotesk Variable', sans-serif;
		text-align: center;
	}

	.boot-mark {
		width: 36px;
		height: 36px;
		border: 3px solid rgba(240, 166, 61, 0.22); /* literal ok: pre-theme boot splash */
		border-top-color: #f0a63d; /* literal ok: pre-theme boot splash */
		border-radius: 50%;
		animation: spin 900ms linear infinite;
	}

	.boot strong {
		font-size: 20px; /* literal ok: pre-theme boot splash */
	}

	.boot span {
		font-size: 14px; /* literal ok: pre-theme boot splash */
		color: #a99b8b; /* literal ok: pre-theme boot splash */
	}

	.boot button {
		margin-top: 4px; /* literal ok: pre-theme boot splash */
		border: 1px solid rgba(240, 166, 61, 0.35); /* literal ok: pre-theme boot splash */
		border-radius: 12px; /* literal ok: pre-theme boot splash */
		padding: 10px 18px; /* literal ok: pre-theme boot splash */
		background: transparent;
		color: #f0a63d; /* literal ok: pre-theme boot splash */
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	@keyframes spin {
		to {
			transform: rotate(1turn);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.boot-mark {
			animation: none;
		}
	}
</style>
