<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { authorizedFetch } from '$lib/core/ha/connection';
	import { configuration } from '$lib/core/app/configuration';
	import { hapticsSupported, sampleVibration, vibrate } from '$lib/core/app/haptics';
	import { lang } from '$lib/core/i18n';
	import { reloadPage } from '$lib/core/app/reload';
	import { editor, requestConfirmation } from '../store';
	import { prefersReducedMotion } from '../screen';
	import EditSheet from './EditSheet.svelte';
	import SelectField from './SelectField.svelte';
	import SettingsRow from './SettingsRow.svelte';
	import Switch from '../Switch.svelte';

	let languages = $state<{ value: string; label: string }[]>([]);
	// the shared values, not what this screen runs with: a screen's own
	// choices live under This screen
	let locale = $state($configuration?.locale || 'en');
	let reduceMotion = $state(!($configuration?.motion ?? !$prefersReducedMotion));
	let touchFeedback = $state($configuration?.haptics === true);
	let feedbackSupported = $state(true);
	let token = $state($configuration?.token ?? '');
	let customJs = $state($configuration?.custom_js ?? false);
	let installedVersion = $state<string>();
	let saveError = $state<string | null>(null);
	// the revision the server holds after another session saved first
	let conflictRevision = $state<number | null>(null);
	let saving = $state(false);

	function staged() {
		return { locale, reduceMotion, touchFeedback, token, customJs };
	}

	let touchFeedbackSub = $derived(
		$lang(feedbackSupported ? 'hearth_touch_feedback_sub' : 'hearth_touch_feedback_unsupported')
	);

	const initial = JSON.stringify(staged());
	let dirty = $derived(JSON.stringify(staged()) !== initial);

	onMount(async () => {
		feedbackSupported = hapticsSupported();
		try {
			const [languageResponse, versionResponse] = await Promise.all([
				fetch(`${base}/_api/list_languages`),
				fetch(`${base}/_api/version`)
			]);
			if (languageResponse.ok) {
				const codes: string[] = await languageResponse.json();
				languages = codes.map((code) => {
					const name = new Intl.DisplayNames([code], { type: 'language' }).of(code) || code;
					return { value: code, label: name.charAt(0).toUpperCase() + name.slice(1) };
				});
			}
			if (versionResponse.ok) installedVersion = (await versionResponse.json())?.installed;
		} catch (error) {
			console.error(error);
		}
	});

	/** `revision` overrides the one loaded with the page, for an explicit overwrite. */
	async function done(revision?: number) {
		if (saving) return;
		saving = true;
		saveError = null;
		conflictRevision = null;

		const next = {
			...($configuration ?? {}),
			locale,
			...(revision === undefined ? {} : { revision })
		};
		if (reduceMotion) next.motion = false;
		else delete next.motion;
		if (touchFeedback) next.haptics = true;
		else delete next.haptics;
		if (token.trim()) next.token = token.trim();
		else delete next.token;
		if (customJs) next.custom_js = true;
		else delete next.custom_js;

		try {
			const json: Record<string, unknown> = { ...next };
			delete json.hassUrl;
			const response = await authorizedFetch(`${base}/_api/save_config`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(json)
			});
			if (response.status === 409) {
				const body = await response.json().catch(() => null);
				conflictRevision = Number.isInteger(body?.revision) ? body.revision : null;
				saveError = $lang('hearth_app_settings_changed');
				vibrate('error');
				return;
			}
			if (!response.ok) {
				saveError =
					response.status === 403
						? $lang('hearth_save_needs_admin')
						: `${$lang('hearth_save_failed')} [${response.status}]`;
				vibrate('error');
				return;
			}

			// language, motion and feedback follow through screen.ts
			$configuration = { ...next, revision: (await response.json()).revision };
			vibrate('success');
			editor.set(null);
		} catch (error) {
			console.error(error);
			saveError = $lang('hearth_save_failed');
			vibrate('error');
		} finally {
			saving = false;
		}
	}

	function handleKeyFocus(event: FocusEvent) {
		const target = event.target as HTMLInputElement;
		target.type = event.type === 'focus' ? 'text' : 'password';
	}

	function confirmOverwrite(revision: number) {
		requestConfirmation({
			title: $lang('hearth_overwrite_newer_app_settings'),
			message: $lang('hearth_overwrite_app_settings_message'),
			confirmLabel: $lang('hearth_overwrite'),
			action: () => void done(revision)
		});
	}
</script>

<EditSheet
	title={$lang('hearth_server_settings')}
	onclose={() => editor.set(null)}
	onback={() => editor.set({ kind: 'settings' })}
	{dirty}
	ondone={() => done()}
	doneLabel={$lang('save')}
	doneDisabled={saving}
>
	<div class="settings">
		<div class="section-note">{$lang('hearth_server_settings_note')}</div>
		<div class="rows">
			{#if languages.length}
				<SettingsRow label={$lang('hearth_default_language')}>
					<SelectField
						inline
						label={$lang('hearth_default_language')}
						bind:value={locale}
						options={languages}
					/>
				</SettingsRow>
			{/if}
			<SettingsRow label={$lang('hearth_reduce_motion')}>
				<Switch
					checked={reduceMotion}
					label={$lang('hearth_reduce_motion')}
					onchange={(checked) => (reduceMotion = checked)}
				/>
			</SettingsRow>
			<SettingsRow label={$lang('hearth_touch_feedback')} sub={touchFeedbackSub}>
				<Switch
					checked={touchFeedback}
					label={$lang('hearth_touch_feedback')}
					onchange={(checked) => {
						touchFeedback = checked;
						// the choice is staged, so the sample bypasses the store
						if (touchFeedback) sampleVibration('press');
					}}
				/>
			</SettingsRow>
			<SettingsRow label={$lang('hearth_long_lived_token')} sub={$lang('hearth_token_hint')}>
				<input
					class="inline-text"
					type="password"
					bind:value={token}
					placeholder="eyJ..."
					autocomplete="new-password"
					spellcheck="false"
					onfocus={handleKeyFocus}
					onblur={handleKeyFocus}
				/>
			</SettingsRow>
			<SettingsRow label={$lang('hearth_custom_js')} sub={$lang('hearth_custom_js_sub')}>
				<Switch
					checked={customJs}
					label={$lang('hearth_custom_js')}
					onchange={(checked) => (customJs = checked)}
				/>
			</SettingsRow>
			<SettingsRow label={$lang('version')}>
				<span class="row-value">{installedVersion ?? $lang('hearth_loading')}</span>
			</SettingsRow>
		</div>
		{#if saveError}
			<div class="error" role="alert">
				<span>{saveError}</span>
				{#if conflictRevision !== null}
					<span class="error-actions">
						<button
							type="button"
							class="hearth-button danger"
							onclick={() => conflictRevision !== null && confirmOverwrite(conflictRevision)}
						>
							{$lang('hearth_overwrite')}
						</button>
						<button type="button" class="hearth-button secondary" onclick={reloadPage}>
							{$lang('hearth_reload')}
						</button>
					</span>
				{/if}
			</div>
		{/if}
	</div>
</EditSheet>

<style>
	.settings {
		display: flex;
		flex-direction: column;
		gap: 18px;
		max-width: 560px;
		margin: 0 auto;
		width: 100%;
	}

	.section-note,
	.error {
		font-size: var(--h-type-small);
		color: var(--h-bad-text);
	}

	.error {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		color: var(--h-bad-text);
	}

	.error-actions {
		display: flex;
		gap: 8px;
		margin-left: auto;
	}

	.rows {
		border-radius: var(--h-radius-sm);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.08 * var(--h-line-scale)));
		background: var(--h-track);
		overflow: hidden;
	}

	.row-value {
		font-size: var(--h-type-body);
		color: var(--h-text-3);
	}

	.inline-text {
		width: min(240px, 45%);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.1 * var(--h-line-scale)));
		border-radius: var(--h-radius-xs);
		background: rgb(var(--h-surface-rgb) / calc(0.06 * var(--h-fill-scale)));
		color: var(--h-text-2);
		font: inherit;
		font-size: var(--h-type-body);
		padding: 8px 12px;
		outline: none;
	}
</style>
