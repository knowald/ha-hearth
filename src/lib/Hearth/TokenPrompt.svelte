<script lang="ts">
	import { base } from '$app/paths';
	import { configuration } from '$lib/core/app/configuration';
	import { lang } from '$lib/core/i18n';
	import EditSheet from './edit/EditSheet.svelte';
	import TextField from './edit/TextField.svelte';

	let { onclose }: { onclose: () => void } = $props();
	let token = $state('');
	let saving = $state(false);
	let error = $state(false);
	async function save() {
		if (saving || !token.trim()) return;
		saving = true;
		error = false;
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
			onclose();
		} catch {
			error = true;
		} finally {
			saving = false;
		}
	}
</script>

<EditSheet title={$lang('login')} {onclose} ondone={save} doneDisabled={saving || !token.trim()}>
	<form
		class="login-form"
		onsubmit={(event) => {
			event.preventDefault();
			save();
		}}
	>
		<p class="hint">{$lang('hearth_token_hint')}</p>
		<TextField
			label={$lang('hearth_long_lived_token')}
			type="password"
			autocomplete="new-password"
			bind:value={token}
		/>
		{#if error}<p class="error" role="alert">{$lang('hearth_save_failed')}</p>{/if}
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

	.error {
		font-size: var(--h-type-small);
		color: var(--h-bad-text);
		margin: 0;
	}
</style>
