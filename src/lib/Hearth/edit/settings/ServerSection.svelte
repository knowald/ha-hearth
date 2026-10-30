<script module lang="ts">
	import type { Configuration } from '$lib/core/app/configuration';

	/** The configuration.yaml keys this section's rows change. */
	export const SETTING_KEYS = [
		'locale',
		'motion',
		'haptics',
		'token',
		'custom_js'
	] as const satisfies readonly (keyof Configuration)[];
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { authorizedFetch } from '$lib/core/ha/connection';
	import { configuration } from '$lib/core/app/configuration';
	import { hapticsSupported, sampleVibration, vibrate } from '$lib/core/app/haptics';
	import { lang } from '$lib/core/i18n';
	import { reloadPage } from '$lib/core/app/reload';
	import { requestConfirmation } from '../../store';
	import { prefersReducedMotion } from '../../screen';
	import SelectField from '../SelectField.svelte';
	import SettingsRow from '../SettingsRow.svelte';
	import Switch from '../../Switch.svelte';
	import SettingsSection from './SettingsSection.svelte';

	/*
	 * Server settings are staged here and written to configuration.yaml only on
	 * save. The parent owns the save and discard controls: it binds `changes`
	 * and `saving`, and calls `save()` and `discard()` through bind:this.
	 */
	let {
		changes = $bindable(0),
		saving = $bindable(false),
		onsaved
	}: {
		/** Read only: how many staged values differ from the saved ones. */
		changes?: number;
		/** Read only: a save is in flight. */
		saving?: boolean;
		onsaved?: () => void;
	} = $props();

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

	function staged() {
		return { locale, reduceMotion, touchFeedback, token, customJs };
	}

	let touchFeedbackSub = $derived(
		$lang(feedbackSupported ? 'hearth_touch_feedback_sub' : 'hearth_touch_feedback_unsupported')
	);

	// what configuration.yaml holds: loaded with the section, then each save
	let saved = $state(staged());

	$effect.pre(() => {
		const current = staged();
		changes = (Object.keys(current) as (keyof typeof current)[]).filter(
			(key) => current[key] !== saved[key]
		).length;
	});

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

	/** Puts every row back to the saved value. */
	export function discard() {
		({ locale, reduceMotion, touchFeedback, token, customJs } = saved);
		saveError = null;
		conflictRevision = null;
	}

	/**
	 * `revision` overrides the one loaded with the page, for an explicit
	 * overwrite. Resolves to whether the values were saved.
	 */
	export async function save(revision?: number) {
		if (saving) return false;
		saving = true;
		saveError = null;
		conflictRevision = null;
		// the rows stay editable during the request; later edits are not part of this save
		const sent = staged();

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
				return false;
			}
			if (!response.ok) {
				saveError =
					response.status === 403
						? $lang('hearth_save_needs_admin')
						: `${$lang('hearth_save_failed')} [${response.status}]`;
				vibrate('error');
				return false;
			}

			// language, motion and feedback follow through screen.ts
			$configuration = { ...next, revision: (await response.json()).revision };
			saved = sent;
			vibrate('success');
			onsaved?.();
			return true;
		} catch (error) {
			console.error(error);
			saveError = $lang('hearth_save_failed');
			vibrate('error');
			return false;
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
			action: () => void save(revision)
		});
	}
</script>

{#snippet failure()}
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
{/snippet}

<SettingsSection
	id="server"
	title={$lang('hearth_server_settings')}
	scope="server"
	keep={saveError !== null}
	after={failure}
>
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
			aria-label={$lang('hearth_long_lived_token')}
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
</SettingsSection>

<style>
	.error {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		font-size: var(--h-type-small);
		color: var(--h-bad-text);
	}

	.error-actions {
		display: flex;
		gap: 8px;
		margin-left: auto;
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
