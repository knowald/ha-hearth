<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { configuration } from '$lib/core/app/configuration';
	import { deviceName, saveDeviceName } from '$lib/core/app/device';
	import { sampleVibration } from '$lib/core/app/haptics';
	import { screenOverrides, setScreenOverride, type ScreenOverrides } from '$lib/core/app/screen';
	import { fill, lang } from '$lib/core/i18n';
	import {
		hasUnsavedEdits,
		hearthConfig,
		reloadDiscardingEdits,
		requestConfirmation
	} from '../store';
	import { prefersReducedMotion, resolveScreenSettings, screenSheetOpen } from '../screen';
	import EditSheet from './EditSheet.svelte';
	import SelectField from './SelectField.svelte';
	import SettingsRow from './SettingsRow.svelte';
	import { sleepOptions, withCurrent, type Option } from './options';
	import { zoomSupported } from '../zoom';
	import Switch from '../Switch.svelte';
	import { favorites, showFavoritesPage } from '../favorites';

	/*
	 * Settings this screen keeps for itself. Every row starts at "Same as
	 * dashboard", which follows the shared value; any other choice applies at
	 * once and stays in this browser.
	 */

	let languages = $state<Option[]>([]);

	function languageName(code: string) {
		try {
			const name = new Intl.DisplayNames([code], { type: 'language' }).of(code) || code;
			return name.charAt(0).toUpperCase() + name.slice(1);
		} catch {
			return code;
		}
	}

	onMount(async () => {
		try {
			const response = await fetch(`${base}/_api/list_languages`);
			if (response.ok) {
				const codes: string[] = await response.json();
				languages = codes.map((code) => ({ value: code, label: languageName(code) }));
			}
		} catch (error) {
			console.error(error);
		}
	});

	/** What this screen would use with one override cleared, for the "Same as" label. */
	function followed(key: keyof ScreenOverrides) {
		const rest = { ...$screenOverrides };
		delete rest[key];
		return resolveScreenSettings($hearthConfig, $configuration, rest, $prefersReducedMotion);
	}

	function same(value: string): Option {
		return { value: '', label: fill($lang('hearth_same_as_dashboard'), { value }) };
	}

	const onOff = (value: boolean) => $lang(value ? 'on' : 'off');
	const percent = (value: number) => `${value}%`;
	const SCALES = Array.from({ length: 16 }, (_, index) => String(50 + index * 10));

	function scaleOptions(value: string, shown: number, label = same(percent(shown))): Option[] {
		return withCurrent(
			[label, ...SCALES.map((scale) => ({ value: scale, label: `${scale}%` }))],
			value,
			$lang
		);
	}

	function flagValue(value: boolean | undefined) {
		return value === undefined ? '' : value ? 'on' : 'off';
	}

	function setFlag(
		key: 'keep_screen_on' | 'reduce_motion' | 'haptics' | 'mute_chimes',
		value: string
	) {
		setScreenOverride(key, value === '' ? undefined : value === 'on');
	}

	function setNumber(key: 'screensaver_minutes' | 'scale' | 'mobile_scale', value: string) {
		setScreenOverride(key, value === '' ? undefined : Number(value));
	}

	function flagOptions(shared: boolean): Option[] {
		return [
			same(onOff(shared)),
			{ value: 'on', label: $lang('on') },
			{ value: 'off', label: $lang('off') }
		];
	}

	let minutes = $derived(String($screenOverrides.screensaver_minutes ?? ''));
	let sharedMinutes = $derived(followed('screensaver_minutes').sleepMinutes);
	let minuteOptions = $derived(
		withCurrent(
			[
				same(
					sleepOptions($lang).find((option) => option.value === String(sharedMinutes))?.label ??
						String(sharedMinutes)
				),
				...sleepOptions($lang)
			],
			minutes,
			$lang
		)
	);

	let mobileFollowed = $derived(followed('mobile_scale'));
	let mobileShown = $derived(mobileFollowed.mobileScale ?? mobileFollowed.scale);

	let sharedLocale = $derived(followed('locale').locale);
	// the stored choice shows by name while the list is still loading
	let languageOptions = $derived.by(() => {
		const chosen = $screenOverrides.locale;
		const unlisted =
			chosen && !languages.some((option) => option.value === chosen)
				? [{ value: chosen, label: languageName(chosen) }]
				: [];
		return [same(languageName(sharedLocale)), ...languages, ...unlisted];
	});

	function handleLogout() {
		requestConfirmation({
			title: $lang('hearth_logout_confirm'),
			message: $lang(
				hasUnsavedEdits() ? 'hearth_logout_confirm_edits_message' : 'hearth_logout_confirm_message'
			),
			confirmLabel: $lang('log_out'),
			action: () => {
				localStorage.removeItem('hearthTokens');
				// the dialog already said what goes with the session
				reloadDiscardingEdits();
			}
		});
	}

	function close() {
		screenSheetOpen.set(false);
	}
</script>

<!-- every row applies as it changes, so the header action only closes -->
<EditSheet
	title={$lang('hearth_this_screen')}
	onclose={close}
	ondone={close}
	doneLabel={$lang('hearth_close')}
>
	<div class="settings">
		<div class="section-note">{$lang('hearth_stored_in_this_browser_only')}</div>
		<div class="rows">
			<SettingsRow label={$lang('hearth_device_name')} sub={$lang('hearth_device_name_sub')}>
				<input
					class="inline-text"
					type="text"
					aria-label={$lang('hearth_device_name')}
					value={$deviceName}
					placeholder="kitchen"
					autocomplete="off"
					spellcheck="false"
					onchange={(event) => saveDeviceName(event.currentTarget.value)}
				/>
			</SettingsRow>
			<SettingsRow
				label={$lang('hearth_keep_screen_awake')}
				sub={$lang('hearth_while_the_dashboard_is_open')}
			>
				<SelectField
					inline
					label={$lang('hearth_keep_screen_awake')}
					value={flagValue($screenOverrides.keep_screen_on)}
					options={flagOptions(followed('keep_screen_on').keepScreenOn)}
					onchange={(value) => setFlag('keep_screen_on', value)}
				/>
			</SettingsRow>
			<SettingsRow label={$lang('hearth_screensaver')}>
				<SelectField
					inline
					label={$lang('hearth_screensaver')}
					value={minutes}
					options={minuteOptions}
					onchange={(value) => setNumber('screensaver_minutes', value)}
				/>
			</SettingsRow>
			<SettingsRow label={$lang('hearth_pixel_shifting')}>
				<Switch
					checked={$screenOverrides.pixel_shift === true}
					label={$lang('hearth_pixel_shifting')}
					onchange={(enabled) => setScreenOverride('pixel_shift', enabled || undefined)}
				/>
			</SettingsRow>
			<SettingsRow
				label={$lang('hearth_interface_scale')}
				sub={zoomSupported ? undefined : $lang('hearth_scale_unsupported')}
			>
				<SelectField
					inline
					label={$lang('hearth_interface_scale')}
					value={String($screenOverrides.scale ?? '')}
					options={scaleOptions(String($screenOverrides.scale ?? ''), followed('scale').scale)}
					onchange={(value) => setNumber('scale', value)}
				/>
			</SettingsRow>
			<SettingsRow
				label={$lang('hearth_scale_at_900_px_and_narrower')}
				sub={$lang(zoomSupported ? 'hearth_screen_mobile_scale_sub' : 'hearth_scale_unsupported')}
			>
				<SelectField
					inline
					label={$lang('hearth_scale_at_900_px_and_narrower')}
					value={String($screenOverrides.mobile_scale ?? '')}
					options={scaleOptions(
						String($screenOverrides.mobile_scale ?? ''),
						mobileShown,
						$screenOverrides.scale === undefined
							? undefined
							: {
									value: '',
									label: fill($lang('hearth_same_as_interface_scale'), {
										value: percent(mobileShown)
									})
								}
					)}
					onchange={(value) => setNumber('mobile_scale', value)}
				/>
			</SettingsRow>
			<SettingsRow label={$lang('language')}>
				<SelectField
					inline
					label={$lang('language')}
					value={$screenOverrides.locale ?? ''}
					options={languageOptions}
					onchange={(value) => setScreenOverride('locale', value || undefined)}
				/>
			</SettingsRow>
			<SettingsRow label={$lang('hearth_reduce_motion')}>
				<SelectField
					inline
					label={$lang('hearth_reduce_motion')}
					value={flagValue($screenOverrides.reduce_motion)}
					options={flagOptions(!followed('reduce_motion').motion)}
					onchange={(value) => setFlag('reduce_motion', value)}
				/>
			</SettingsRow>
			<SettingsRow
				label={$lang('hearth_show_favorites_page')}
				sub={$lang('hearth_show_favorites_page_sub')}
			>
				<Switch
					checked={$favorites.page}
					label={$lang('hearth_show_favorites_page')}
					onchange={showFavoritesPage}
				/>
			</SettingsRow>
			<SettingsRow label={$lang('hearth_touch_feedback')} sub={$lang('hearth_touch_feedback_sub')}>
				<SelectField
					inline
					label={$lang('hearth_touch_feedback')}
					value={flagValue($screenOverrides.haptics)}
					options={flagOptions(followed('haptics').haptics)}
					onchange={(value) => {
						setFlag('haptics', value);
						if (value === 'on') sampleVibration('press');
					}}
				/>
			</SettingsRow>
			<SettingsRow label={$lang('hearth_mute_alert_chimes')}>
				<SelectField
					inline
					label={$lang('hearth_mute_alert_chimes')}
					value={flagValue($screenOverrides.mute_chimes)}
					options={flagOptions(false)}
					onchange={(value) => setFlag('mute_chimes', value)}
				/>
			</SettingsRow>
		</div>
		<div class="rows">
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

	.section-note {
		font-size: var(--h-type-small);
		color: var(--h-text-6);
	}

	.rows {
		border-radius: var(--h-radius-sm);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.08 * var(--h-line-scale)));
		background: var(--h-track);
		overflow: hidden;
	}

	/* "Same as dashboard (100%)" needs more than the usual inline select width */
	.rows :global(.inline select) {
		width: min(250px, calc(50 * var(--h-vw)));
	}

	.inline-text {
		width: min(250px, 45%);
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
