<script module lang="ts">
	import type { ScreenOverrides } from '$lib/core/app/screen';

	/** The screen overrides this section's rows change, kept in this browser. */
	export const SETTING_KEYS = [
		'keep_screen_on',
		'screensaver_minutes',
		'pixel_shift',
		'scale',
		'mobile_scale',
		'locale',
		'reduce_motion',
		'haptics',
		'mute_chimes',
		'presence_entity',
		'presence_fade_seconds',
		'presence_delay_minutes',
		'presence_view'
	] as const satisfies readonly (keyof ScreenOverrides)[];
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { configuration } from '$lib/core/app/configuration';
	import { deviceName, saveDeviceName } from '$lib/core/app/device';
	import { sampleVibration } from '$lib/core/app/haptics';
	import { screenOverrides, setScreenOverride } from '$lib/core/app/screen';
	import { fill, lang } from '$lib/core/i18n';
	import {
		hasUnsavedEdits,
		hearthConfig,
		reloadDiscardingEdits,
		requestConfirmation
	} from '../../store';
	import { PRESENCE_FADE_SECONDS, prefersReducedMotion, resolveScreenSettings } from '../../screen';
	import EntityField from '../EntityField.svelte';
	import SelectField from '../SelectField.svelte';
	import SettingsRow from '../SettingsRow.svelte';
	import { sleepOptions, withCurrent, type Option } from '../options';
	import { zoomSupported } from '../../zoom';
	import Switch from '../../Switch.svelte';
	import { favorites, showFavoritesPage } from '../../favorites';
	import { settingsGuard } from './guard';
	import PresenceStatus from './PresenceStatus.svelte';
	import SettingsSection from './SettingsSection.svelte';

	/*
	 * Settings this screen keeps for itself. A row without its own value shows
	 * the shared one under a Dashboard tag and follows it; any choice applies
	 * at once, stays in this browser, and offers a link back to the shared
	 * value.
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

	/** What this screen would use with one override cleared: the value a reset brings back. */
	function followed(key: keyof ScreenOverrides) {
		const rest = { ...$screenOverrides };
		delete rest[key];
		return resolveScreenSettings($hearthConfig, $configuration, rest, $prefersReducedMotion);
	}

	/** The tag and reset link of a row this screen can override, see SettingsRow. */
	function inherit(
		key: keyof ScreenOverrides,
		shown: string,
		source: 'dashboard' | 'interface_scale' = 'dashboard'
	) {
		const dashboard = source === 'dashboard';
		return {
			overridden: $screenOverrides[key] !== undefined,
			from: $lang(dashboard ? 'hearth_dashboard' : 'hearth_interface_scale'),
			reset: fill(
				$lang(dashboard ? 'hearth_reset_to_dashboard' : 'hearth_reset_to_interface_scale'),
				{ value: shown }
			),
			onreset: () => setScreenOverride(key, undefined)
		};
	}

	const onOff = (value: boolean) => $lang(value ? 'on' : 'off');
	const percent = (value: number) => `${value}%`;
	const SCALES = Array.from({ length: 16 }, (_, index) => String(50 + index * 10));

	function scaleOptions(value: string): Option[] {
		return withCurrent(
			SCALES.map((scale) => ({ value: scale, label: `${scale}%` })),
			value,
			$lang
		);
	}

	function setNumber(key: 'screensaver_minutes' | 'scale' | 'mobile_scale', value: string) {
		setScreenOverride(key, Number(value));
	}

	let sharedMinutes = $derived(followed('screensaver_minutes').sleepMinutes);
	let minutes = $derived(String($screenOverrides.screensaver_minutes ?? sharedMinutes));
	let minuteOptions = $derived(withCurrent(sleepOptions($lang), minutes, $lang));
	let sharedMinutesLabel = $derived(
		sleepOptions($lang).find((option) => option.value === String(sharedMinutes))?.label ??
			String(sharedMinutes)
	);

	let fadeSeconds = $derived(
		String($screenOverrides.presence_fade_seconds ?? PRESENCE_FADE_SECONDS)
	);
	let fadeOptions = $derived(
		withCurrent(
			[
				{ value: '0', label: $lang('hearth_presence_fade_instant') },
				{ value: '1', label: $lang('hearth_one_second') },
				...[2, 5, 10, 30].map((count) => ({
					value: String(count),
					label: fill($lang('hearth_seconds_count'), { count })
				}))
			],
			fadeSeconds,
			$lang
		)
	);

	let delayMinutes = $derived(String($screenOverrides.presence_delay_minutes ?? 0));
	let delayOptions = $derived(
		withCurrent(
			[
				{ value: '0', label: $lang('hearth_presence_delay_none') },
				{ value: '1', label: $lang('hearth_after_1_minute') },
				{ value: '5', label: $lang('hearth_after_5_minutes') },
				{ value: '10', label: $lang('hearth_after_10_minutes') },
				{ value: '15', label: $lang('hearth_after_15_minutes') }
			],
			delayMinutes,
			$lang
		)
	);

	let sharedScale = $derived(followed('scale').scale);
	let scale = $derived(String($screenOverrides.scale ?? sharedScale));

	let mobileFollowed = $derived(followed('mobile_scale'));
	let mobileShown = $derived(mobileFollowed.mobileScale ?? mobileFollowed.scale);
	let mobileScale = $derived(String($screenOverrides.mobile_scale ?? mobileShown));

	let sharedLocale = $derived(followed('locale').locale);
	let locale = $derived($screenOverrides.locale ?? sharedLocale);
	// the shown language keeps its name while the list is still loading
	let languageOptions = $derived(
		languages.some((option) => option.value === locale)
			? languages
			: [...languages, { value: locale, label: languageName(locale) }]
	);

	let sharedKeepScreenOn = $derived(followed('keep_screen_on').keepScreenOn);
	let sharedReduceMotion = $derived(!followed('reduce_motion').motion);
	let sharedHaptics = $derived(followed('haptics').haptics);

	const guard = settingsGuard();

	// the reload that follows skips the unload guard, so the dialog names what it drops
	function logoutMessage() {
		if (guard.serverChanged()) return 'hearth_logout_confirm_unsaved_message';
		return hasUnsavedEdits()
			? 'hearth_logout_confirm_edits_message'
			: 'hearth_logout_confirm_message';
	}

	function handleLogout() {
		requestConfirmation({
			title: $lang('hearth_logout_confirm'),
			message: $lang(logoutMessage()),
			confirmLabel: $lang('log_out'),
			action: () => {
				localStorage.removeItem('hearthTokens');
				// the dialog already said what goes with the session
				reloadDiscardingEdits();
			}
		});
	}
</script>

<SettingsSection id="screen" title={$lang('hearth_this_screen')} scope="browser">
	<SettingsRow label={$lang('hearth_device_name')} sub={$lang('hearth_device_name_sub')}>
		<input
			class="inline-text wide-control"
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
		inherit={inherit('keep_screen_on', onOff(sharedKeepScreenOn))}
	>
		<Switch
			checked={$screenOverrides.keep_screen_on ?? sharedKeepScreenOn}
			label={$lang('hearth_keep_screen_awake')}
			onchange={(checked) => setScreenOverride('keep_screen_on', checked)}
		/>
	</SettingsRow>
	<SettingsRow
		label={$lang('hearth_screensaver')}
		inherit={inherit('screensaver_minutes', sharedMinutesLabel)}
	>
		<SelectField
			inline
			label={$lang('hearth_screensaver')}
			value={minutes}
			options={minuteOptions}
			onchange={(value) => setNumber('screensaver_minutes', value)}
		/>
	</SettingsRow>
	<SettingsRow label={$lang('hearth_presence_sensor')} sub={$lang('hearth_presence_sensor_hint')}>
		<div class="wide-control">
			<EntityField
				inline
				label={$lang('hearth_presence_sensor')}
				domains={['binary_sensor']}
				deviceClass="occupancy"
				value={$screenOverrides.presence_entity ?? ''}
				onchange={(value) => setScreenOverride('presence_entity', value.trim() || undefined)}
			/>
			{#if $screenOverrides.presence_entity}
				<PresenceStatus entity={$screenOverrides.presence_entity} />
			{/if}
		</div>
	</SettingsRow>
	{#if $screenOverrides.presence_entity}
		<SettingsRow label={$lang('hearth_presence_delay')} sub={$lang('hearth_presence_delay_sub')}>
			<SelectField
				inline
				label={$lang('hearth_presence_delay')}
				value={delayMinutes}
				options={delayOptions}
				onchange={(value) => setScreenOverride('presence_delay_minutes', Number(value))}
			/>
		</SettingsRow>
		<SettingsRow label={$lang('hearth_presence_view')} sub={$lang('hearth_presence_view_sub')}>
			<SelectField
				inline
				label={$lang('hearth_presence_view')}
				value={$screenOverrides.presence_view ?? 'black'}
				options={[
					{ value: 'black', label: $lang('hearth_presence_view_black') },
					{ value: 'dim', label: $lang('hearth_presence_view_dim') }
				]}
				onchange={(value) => setScreenOverride('presence_view', value === 'dim' ? 'dim' : 'black')}
			/>
		</SettingsRow>
		<SettingsRow label={$lang('hearth_presence_fade')} sub={$lang('hearth_presence_fade_sub')}>
			<SelectField
				inline
				label={$lang('hearth_presence_fade')}
				value={fadeSeconds}
				options={fadeOptions}
				onchange={(value) => setScreenOverride('presence_fade_seconds', Number(value))}
			/>
		</SettingsRow>
	{/if}
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
		inherit={inherit('scale', percent(sharedScale))}
	>
		<SelectField
			inline
			label={$lang('hearth_interface_scale')}
			value={scale}
			options={scaleOptions(scale)}
			onchange={(value) => setNumber('scale', value)}
		/>
	</SettingsRow>
	<SettingsRow
		label={$lang('hearth_scale_at_900_px_and_narrower')}
		sub={$lang(zoomSupported ? 'hearth_screen_mobile_scale_sub' : 'hearth_scale_unsupported')}
		inherit={inherit(
			'mobile_scale',
			percent(mobileShown),
			$screenOverrides.scale === undefined ? 'dashboard' : 'interface_scale'
		)}
	>
		<SelectField
			inline
			label={$lang('hearth_scale_at_900_px_and_narrower')}
			value={mobileScale}
			options={scaleOptions(mobileScale)}
			onchange={(value) => setNumber('mobile_scale', value)}
		/>
	</SettingsRow>
	<SettingsRow label={$lang('language')} inherit={inherit('locale', languageName(sharedLocale))}>
		<SelectField
			inline
			label={$lang('language')}
			value={locale}
			options={languageOptions}
			onchange={(value) => setScreenOverride('locale', value)}
		/>
	</SettingsRow>
	<SettingsRow
		label={$lang('hearth_reduce_motion')}
		inherit={inherit('reduce_motion', onOff(sharedReduceMotion))}
	>
		<Switch
			checked={$screenOverrides.reduce_motion ?? sharedReduceMotion}
			label={$lang('hearth_reduce_motion')}
			onchange={(checked) => setScreenOverride('reduce_motion', checked)}
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
	<SettingsRow
		label={$lang('hearth_touch_feedback')}
		sub={$lang('hearth_touch_feedback_sub')}
		inherit={inherit('haptics', onOff(sharedHaptics))}
	>
		<Switch
			checked={$screenOverrides.haptics ?? sharedHaptics}
			label={$lang('hearth_touch_feedback')}
			onchange={(checked) => {
				setScreenOverride('haptics', checked);
				if (checked) sampleVibration('press');
			}}
		/>
	</SettingsRow>
	<SettingsRow
		label={$lang('hearth_mute_alert_chimes')}
		inherit={inherit('mute_chimes', onOff(false))}
	>
		<Switch
			checked={$screenOverrides.mute_chimes ?? false}
			label={$lang('hearth_mute_alert_chimes')}
			onchange={(checked) => setScreenOverride('mute_chimes', checked)}
		/>
	</SettingsRow>
	<SettingsRow
		icon="logout"
		label={$lang('log_out')}
		sub={$lang('hearth_clears_the_home_assistant_session')}
		danger
		chevron={false}
		onclick={handleLogout}
	/>
</SettingsSection>

<style>
	.inline-text {
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
