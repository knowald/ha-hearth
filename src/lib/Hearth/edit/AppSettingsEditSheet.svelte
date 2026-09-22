<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { configuration } from '$lib/core/app/configuration';
	import {
		hapticCapabilities,
		haptics,
		hapticsSupported,
		sampleVibration,
		vibrate
	} from '$lib/core/app/haptics';
	import { motion } from '$lib/core/app/motion';
	import { MOTION } from '$lib/core/theme';
	import { lang, selectedLanguage, translation } from '$lib/core/i18n';
	import { editor, requestConfirmation, type Editor } from '../store';
	import EditSheet from './EditSheet.svelte';
	import SelectField from './SelectField.svelte';
	import SettingsRow from './SettingsRow.svelte';
	import Switch from '../Switch.svelte';

	let languages = $state<{ value: string; label: string }[]>([]);
	let locale = $state($selectedLanguage || 'en');
	let reduceMotion = $state($motion === 0);
	let touchFeedback = $state($haptics);
	let feedbackSupported = $state(true);
	let feedbackNeedsHttps = $state(false);
	let token = $state($configuration?.token ?? '');
	let customJs = $state($configuration?.custom_js ?? false);
	let installedVersion = $state<string>();
	let saveError = $state<string | null>(null);
	let saving = $state(false);

	function staged() {
		return { locale, reduceMotion, touchFeedback, token, customJs };
	}

	let touchFeedbackSub = $derived(
		$lang(
			feedbackSupported
				? 'hearth_touch_feedback_sub'
				: feedbackNeedsHttps
					? 'hearth_touch_feedback_needs_https'
					: 'hearth_touch_feedback_unsupported'
		)
	);

	const initial = JSON.stringify(staged());
	let dirty = $derived(JSON.stringify(staged()) !== initial);

	onMount(async () => {
		feedbackSupported = hapticsSupported();
		feedbackNeedsHttps = !feedbackSupported && !hapticCapabilities().secureContext;
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

	/** Every exit short of Done, so staged edits are never dropped silently. */
	function leave(next: Editor | null) {
		if (!dirty) {
			editor.set(next);
			return;
		}
		requestConfirmation({
			title: $lang('unsaved_changes_title'),
			message: $lang('unsaved_changes'),
			confirmLabel: $lang('hearth_discard'),
			action: () => editor.set(next)
		});
	}

	async function done() {
		if (saving) return;
		saving = true;
		saveError = null;

		const next = {
			...($configuration ?? {}),
			locale
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
			const response = await fetch(`${base}/_api/save_config`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(json)
			});
			if (!response.ok) {
				saveError = `${$lang('hearth_save_failed')} [${response.status}]`;
				vibrate('error');
				return;
			}

			$configuration = { ...next, revision: (await response.json()).revision };
			$selectedLanguage = locale;
			$motion = reduceMotion ? 0 : MOTION.base;
			$haptics = touchFeedback;
			vibrate('success');
			document.documentElement.lang = locale || 'en';

			const translationResponse = await fetch(`${base}/_api/get_translation`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ locale })
			});
			if (translationResponse.ok) $translation = await translationResponse.json();
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

	function handleLogout() {
		if (!confirm($lang('hearth_logout_confirm'))) return;
		localStorage.removeItem('hearthTokens');
		location.reload();
	}
</script>

<EditSheet
	title={$lang('hearth_application_settings')}
	onclose={() => leave(null)}
	onback={() => leave({ kind: 'settings' })}
	ondone={done}
	doneDisabled={saving}
>
	<div class="settings">
		<div class="section-note">{$lang('hearth_changes_are_staged_until_you_choose')}</div>
		<div class="rows">
			{#if languages.length}
				<SettingsRow label={$lang('language')}>
					<SelectField inline label={$lang('language')} bind:value={locale} options={languages} />
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
		{#if saveError}<div class="error" role="alert">{saveError}</div>{/if}

		<div class="rows">
			<SettingsRow
				icon="css"
				label={$lang('hearth_custom_css')}
				sub={$lang('hearth_custom_css_sub')}
				onclick={() => leave({ kind: 'customCss' })}
			/>
			<SettingsRow
				icon="logout"
				label={$lang('log_out')}
				sub={$lang('hearth_clears_the_home_assistant_session')}
				danger
				chevron={false}
				onclick={handleLogout}
			/>
		</div>
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
		color: var(--h-text-6);
	}

	.error {
		color: var(--h-bad-text);
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
