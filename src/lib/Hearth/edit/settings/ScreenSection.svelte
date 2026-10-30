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
	import Searchable from './Searchable.svelte';
	import SettingsSection from './SettingsSection.svelte';

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
	<!-- "Same as dashboard (100%)" needs more than the usual inline select width -->
	<div class="wide-selects">
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
		<Searchable text={[$lang('hearth_presence_sensor'), $lang('hearth_presence_sensor_hint')]}>
			<div class="row-field">
				<EntityField
					label={$lang('hearth_presence_sensor')}
					hint={$lang('hearth_presence_sensor_hint')}
					domains={['binary_sensor']}
					deviceClass="occupancy"
					value={$screenOverrides.presence_entity ?? ''}
					onchange={(value) => setScreenOverride('presence_entity', value.trim() || undefined)}
				/>
				{#if $screenOverrides.presence_entity}
					<PresenceStatus entity={$screenOverrides.presence_entity} />
				{/if}
			</div>
		</Searchable>
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
					onchange={(value) =>
						setScreenOverride('presence_view', value === 'dim' ? 'dim' : 'black')}
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
		<SettingsRow
			icon="logout"
			label={$lang('log_out')}
			sub={$lang('hearth_clears_the_home_assistant_session')}
			danger
			chevron={false}
			onclick={handleLogout}
		/>
	</div>
</SettingsSection>

<style>
	.row-field {
		padding: 14px 16px 2px;
		border-top: 1px solid rgb(var(--h-line-rgb) / calc(0.06 * var(--h-line-scale)));
	}

	.row-field + :global(.row) {
		border-top: 1px solid rgb(var(--h-line-rgb) / calc(0.06 * var(--h-line-scale)));
	}

	.wide-selects :global(.inline select) {
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
