<script lang="ts">
	import { fill, lang } from '$lib/core/i18n';
	import TextField from './edit/TextField.svelte';
	import {
		directAddress,
		isIngressPath,
		isLocalAddress,
		qrModules,
		qrPath,
		tabletUrl
	} from './tabletLink';

	/*
	 * The setup wizard's last step: the address a wall tablet opens, as text
	 * and as a QR code, with the device name the tablet should answer to.
	 */

	const ingress = isIngressPath(location.pathname);
	let address = $state(directAddress(location) ?? '');
	let device = $state('');
	let url = $derived(tabletUrl(address, device));
	let modules = $state<boolean[][] | null>(null);
	let qrFailed = $state(false);

	let addressHint = $derived(
		url && isLocalAddress(url) ? $lang('hearth_tablet_localhost') : undefined
	);
	let addressError = $derived(
		address.trim() && !url ? $lang('hearth_tablet_address_invalid') : undefined
	);

	$effect(() => {
		const text = url;
		modules = null;
		qrFailed = false;
		if (!text) return;
		let current = true;
		qrModules(text).then(
			(result) => {
				if (current) modules = result;
			},
			(error) => {
				console.warn('QR code unavailable', error);
				if (current) qrFailed = true;
			}
		);
		return () => {
			current = false;
		};
	});
</script>

<div class="tablet">
	<p class="intro">{$lang('hearth_tablet_intro')}</p>
	{#if ingress}
		<p class="note">{$lang('hearth_tablet_ingress_hint')}</p>
	{/if}
	<TextField
		label={$lang('hearth_tablet_address')}
		bind:value={address}
		placeholder="http://homeassistant.local:5050"
		autocomplete="off"
		hint={addressHint}
		error={addressError}
	/>
	<TextField
		label={$lang('hearth_device_name')}
		hint={$lang('hearth_tablet_device_hint')}
		bind:value={device}
		placeholder="kitchen"
		autocomplete="off"
	/>
	{#if url}
		<figure class="code">
			{#if qrFailed}
				<p class="note" role="alert">{$lang('hearth_tablet_qr_failed')}</p>
			{:else}
				<div class="qr">
					{#if modules}
						<svg
							role="img"
							aria-label={fill($lang('hearth_tablet_qr'), { url })}
							viewBox="-2 -2 {modules.length + 4} {modules.length + 4}"
							shape-rendering="crispEdges"
						>
							<path d={qrPath(modules)} />
						</svg>
					{/if}
				</div>
			{/if}
			<figcaption class="url">{url}</figcaption>
		</figure>
	{/if}
</div>

<style>
	.tablet {
		display: flex;
		flex-direction: column;
	}

	.intro,
	.note {
		margin: 10px 0 14px;
		font-size: var(--h-type-secondary);
		line-height: 1.5;
		color: var(--h-text-4);
	}

	.note {
		margin-top: 0;
		color: var(--h-text-5);
	}

	.code {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		margin: 8px 0 0;
	}

	/* a scanner needs dark modules on light paper whatever the theme */
	.qr {
		width: 200px;
		height: 200px;
		padding: 10px;
		border-radius: var(--h-radius-sm);
		background: #fff; /* literal ok: QR codes scan as dark on light */
	}

	.qr svg {
		display: block;
		width: 100%;
		height: 100%;
		fill: #000; /* literal ok: QR codes scan as dark on light */
	}

	.url {
		font-family: var(--h-font-mono);
		font-size: var(--h-type-small);
		color: var(--h-text-3);
		overflow-wrap: anywhere;
		text-align: center;
		user-select: all;
	}
</style>
