<script lang="ts">
	import { base } from '$app/paths';
	import { tick } from 'svelte';
	import { get } from 'svelte/store';
	import { configuration } from '$lib/core/app/configuration';
	import { connected, connectionError } from '$lib/core/ha/connection';
	import { lang } from '$lib/core/i18n';
	import EditSheet from './edit/EditSheet.svelte';
	import TextField from './edit/TextField.svelte';

	let { onclose }: { onclose: () => void } = $props();
	let token = $state('');
	let saving = $state(false);
	let error = $state(false);
	let checking = $state(false);
	let rejected = $state(false);
	const replacingToken = Boolean(get(configuration)?.token);

	// the sheet stays open until Home Assistant has accepted or refused the saved token
	$effect(() => {
		if (!checking) return;
		if ($connected) {
			onclose();
		} else if ($connectionError === 'invalid_auth') {
			checking = false;
			rejected = true;
		}
	});

	async function save() {
		if (saving || !token.trim()) return;
		saving = true;
		error = false;
		rejected = false;
		checking = false;
		try {
			const next = {
				...$configuration,
				token: token.trim(),
				revision: $configuration.revision ?? 0
			};
			const document: Record<string, unknown> = { ...next };
			delete document.hassUrl;
			const response = await fetch(`${base}/_api/save_config`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(document)
			});
			if (!response.ok) throw new Error('Token save failed');
			$configuration = { ...next, revision: (await response.json()).revision };
			// the page restarts the connection in its effect for the new token, which
			// also clears the previous run's error; checking before that would read it
			await tick();
			checking = true;
		} catch {
			error = true;
		} finally {
			saving = false;
		}
	}
</script>

<EditSheet
	title={$lang('hearth_sign_in')}
	doneLabel={$lang('hearth_sign_in')}
	{onclose}
	ondone={save}
	doneDisabled={saving || !token.trim()}
>
	<form
		class="login-form"
		onsubmit={(event) => {
			event.preventDefault();
			save();
		}}
	>
		<p class="hint">
			{$lang(replacingToken ? 'hearth_token_rejected_hint' : 'hearth_token_hint')}
		</p>
		<TextField
			label={$lang('hearth_long_lived_token')}
			type="password"
			autocomplete="new-password"
			bind:value={token}
		/>
		<p class="status" role="status">{checking ? $lang('hearth_token_checking') : ''}</p>
		{#if error}<p class="error" role="alert">{$lang('hearth_save_failed')}</p>{/if}
		{#if rejected}<p class="error" role="alert">{$lang('hearth_token_rejected')}</p>{/if}
	</form>
</EditSheet>

<style>
	.login-form {
		grid-column: 1 / -1;
		margin: 0;
	}

	.hint {
		font-size: var(--h-type-body);
		line-height: 1.5;
		color: var(--h-text-4);
		margin: 0 0 18px;
	}

	.status:empty {
		display: none;
	}

	.status {
		font-size: var(--h-type-small);
		color: var(--h-text-4);
		margin: 0;
	}

	.error {
		font-size: var(--h-type-small);
		color: var(--h-bad-text);
		margin: 0;
	}
</style>
