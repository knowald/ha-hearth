<script lang="ts">
	import { tick } from 'svelte';
	import { integerFromInput, numberFromInput } from './numbers';
	import { ICON } from '../iconSizes';
	import { fill, lang } from '$lib/core/i18n';
	import { config as haConfig } from '$lib/core/ha/connection';
	import { states } from '$lib/core/ha/entities';
	import { screenOverrides } from '$lib/core/app/screen';
	import {
		GREETING_MINUTES,
		isTileUrl,
		moveItem,
		PHOTO_SECONDS,
		RADAR_ZOOM,
		railPositionOf,
		type AlertChimes,
		type AlertSeverity,
		type RailPosition,
		type ScreensaverBackground,
		type ScreensaverRadar
	} from '../config';
	import {
		editor,
		hearthConfig,
		screensaverPreview,
		setupWizardOpen,
		updateConfig
	} from '../store';
	import EditSheet from './EditSheet.svelte';
	import EntityField from './EntityField.svelte';
	import Icon from '../Icon.svelte';
	import ImageField from './ImageField.svelte';
	import PhotoListField from './PhotoListField.svelte';
	import SelectField from './SelectField.svelte';
	import SettingsRow from './SettingsRow.svelte';
	import TextField from './TextField.svelte';
	import Switch from '../Switch.svelte';
	import { wakeLockState } from '../wakeLock';
	import { zoomSupported } from '../zoom';
	import { screenSheetOpen } from '../screen';
	import type { ChimeTone } from '../chime';
	import { DEFAULT_CHIME_VOLUME } from '../model/alerts';
	import { chimeOptions, chimeValue, sleepOptions, storedChime, withCurrent } from './options';

	let screensaver = $derived(String($hearthConfig.screensaver_minutes ?? 0));
	let screensaverDrift = $derived($hearthConfig.screensaver_drift ?? false);
	let screensaverBrightness = $derived(String($hearthConfig.screensaver_brightness ?? 32));
	let showDate = $derived($hearthConfig.screensaver_show_date ?? true);
	let clockSize = $derived($hearthConfig.screensaver_clock_size ?? 'medium');
	let weatherEntity = $derived($hearthConfig.screensaver_weather_entity ?? '');
	let background = $derived($hearthConfig.screensaver_background ?? 'none');
	let backgroundImage = $derived($hearthConfig.screensaver_image ?? '');
	let radar = $derived($hearthConfig.screensaver_radar ?? {});
	let photos = $derived($hearthConfig.screensaver_photos ?? []);
	let photoSeconds = $derived(
		String($hearthConfig.screensaver_photo_seconds ?? PHOTO_SECONDS.fallback)
	);
	let photoOrder = $derived($hearthConfig.screensaver_photo_order ?? 'shuffle');
	let mediaEntity = $derived($hearthConfig.screensaver_media_entity ?? '');
	let mediaFallback = $derived($hearthConfig.screensaver_media_fallback ?? 'none');
	// a media background shows its fallback's fields too, since that is what shows most of the time
	let scene = $derived(background === 'media' ? mediaFallback : background);
	let useHomeLocation = $derived(radar.latitude === undefined || radar.longitude === undefined);
	// without a home location in Home Assistant, only custom coordinates can work
	let homeKnown = $derived(
		Number.isFinite($haConfig?.latitude) && Number.isFinite($haConfig?.longitude)
	);
	let coordinateInvalid = $state({ latitude: false, longitude: false });
	let tileUrlInvalid = $state(false);
	let keepScreenOn = $derived($hearthConfig.keep_screen_on ?? true);
	let scrollEdgeBlur = $derived($hearthConfig.scroll_edge_blur ?? true);
	let animations = $derived($hearthConfig.animations ?? true);
	let railPosition = $derived(railPositionOf($hearthConfig));
	let swipeMobile = $derived($hearthConfig.swipe_navigation_mobile ?? false);
	let swipeDesktop = $derived($hearthConfig.swipe_navigation_desktop ?? false);
	let phoneClock = $derived($hearthConfig.phone_clock ?? false);
	let paddingX = $derived($hearthConfig.padding_x ?? 0);
	let paddingY = $derived($hearthConfig.padding_y ?? 0);
	let mobilePaddingX = $derived($hearthConfig.mobile_padding_x ?? paddingX);
	let mobilePaddingY = $derived($hearthConfig.mobile_padding_y ?? paddingY);
	let scale = $derived($hearthConfig.scale ?? 100);
	let mobileScale = $derived($hearthConfig.mobile_scale ?? scale);

	let SCREENSAVER_OPTIONS = $derived(withCurrent(sleepOptions($lang), screensaver, $lang));
	let SCREENSAVER_BRIGHTNESS_OPTIONS = $derived(
		withCurrent(
			[
				{ value: '18', label: $lang('hearth_very_dim') },
				{ value: '32', label: $lang('hearth_dim') },
				{ value: '50', label: $lang('fan_speed_medium') },
				{ value: '75', label: $lang('hearth_bright') }
			],
			screensaverBrightness,
			$lang
		)
	);

	// a row whose value this screen overrides says so, or a change here would
	// seem to do nothing on the screen being edited
	function sharedSub(key: keyof typeof $screenOverrides, sub?: string) {
		return $screenOverrides[key] === undefined ? sub : $lang('hearth_this_screen_uses_its_own');
	}

	let editLock = $derived($hearthConfig.edit_lock ?? 'off');
	let editPin = $derived($hearthConfig.edit_pin ?? '');
	let pinInvalid = $state(false);
	let EDIT_LOCK_OPTIONS = $derived([
		{ value: 'off', label: $lang('off') },
		{ value: 'hold', label: $lang('hearth_edit_lock_hold') },
		{ value: 'pin', label: $lang('hearth_edit_lock_pin') }
	]);

	function setEditLock(value: string) {
		updateConfig((config) => {
			config.edit_lock = value === 'hold' || value === 'pin' ? value : undefined;
			if (value !== 'pin') config.edit_pin = undefined;
		});
	}

	function setEditPin(value: string) {
		const pin = value.trim();
		pinInvalid = !/^\d{4,8}$/.test(pin);
		if (pinInvalid) return;
		updateConfig((config) => {
			config.edit_pin = pin;
		});
	}

	let RAIL_POSITION_OPTIONS = $derived([
		{ value: 'left', label: $lang('hearth_sidebar_left') },
		{ value: 'right', label: $lang('hearth_sidebar_right') },
		{ value: 'both', label: $lang('hearth_sidebar_both') },
		{ value: 'none', label: $lang('hearth_sidebar_none') }
	]);

	function movePage(index: number, delta: number) {
		updateConfig((config) => moveItem(config.rooms, index, delta));
	}

	function setRailPosition(value: string) {
		updateConfig((config) => {
			config.rail_position = value === 'left' ? undefined : (value as RailPosition);
		});
	}

	let CLOCK_SIZE_OPTIONS = $derived([
		{ value: 'small', label: $lang('hearth_small') },
		{ value: 'medium', label: $lang('fan_speed_medium') },
		{ value: 'large', label: $lang('hearth_large') }
	]);
	let BACKGROUND_OPTIONS = $derived([
		{ value: 'none', label: $lang('hearth_sleep_background_none') },
		{ value: 'image', label: $lang('hearth_sleep_background_image') },
		{ value: 'radar', label: $lang('hearth_sleep_background_radar') },
		{ value: 'photos', label: $lang('hearth_sleep_background_photos') },
		{ value: 'sun', label: $lang('hearth_sleep_background_sun') },
		{ value: 'media', label: $lang('hearth_sleep_background_media') }
	]);
	let MEDIA_FALLBACK_OPTIONS = $derived(
		BACKGROUND_OPTIONS.filter((option) => option.value !== 'media')
	);
	let PHOTO_ORDER_OPTIONS = $derived([
		{ value: 'shuffle', label: $lang('hearth_sleep_photo_order_shuffle') },
		{ value: 'sequence', label: $lang('hearth_sleep_photo_order_sequence') }
	]);
	let PHOTO_SECONDS_OPTIONS = $derived(
		withCurrent(
			[
				{ value: '10', label: $lang('hearth_every_10_seconds') },
				{ value: '30', label: $lang('hearth_every_30_seconds') },
				{ value: '60', label: $lang('hearth_every_minute') },
				{ value: '300', label: $lang('hearth_every_5_minutes') }
			],
			photoSeconds,
			$lang
		)
	);
	let BASEMAP_OPTIONS = $derived([
		{ value: 'dark', label: $lang('hearth_dark') },
		{ value: 'light', label: $lang('hearth_light') }
	]);
	let COORDINATES = $derived([
		{ axis: 'latitude', label: $lang('hearth_sleep_latitude'), limit: 90 },
		{ axis: 'longitude', label: $lang('hearth_sleep_longitude'), limit: 180 }
	] as const);
	const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
	const ZOOM_OPTIONS = Array.from({ length: RADAR_ZOOM.max - RADAR_ZOOM.min + 1 }, (_, index) => {
		const zoom = String(RADAR_ZOOM.min + index);
		return { value: zoom, label: zoom };
	});

	function setScreensaver(value: string) {
		const minutes = integerFromInput(value);
		updateConfig((config) => {
			config.screensaver_minutes = minutes > 0 ? minutes : undefined;
		});
	}

	function setScreensaverDrift(enabled: boolean) {
		updateConfig((config) => {
			config.screensaver_drift = enabled ? true : undefined;
		});
	}

	function setScreensaverBrightness(value: string) {
		const brightness = integerFromInput(value);
		updateConfig((config) => {
			config.screensaver_brightness = brightness === 32 ? undefined : brightness;
		});
	}

	function setShowDate(enabled: boolean) {
		updateConfig((config) => {
			config.screensaver_show_date = enabled ? undefined : false;
		});
	}

	function setClockSize(value: string) {
		updateConfig((config) => {
			config.screensaver_clock_size = value === 'small' || value === 'large' ? value : undefined;
		});
	}

	function setWeatherEntity(value: string) {
		updateConfig((config) => {
			config.screensaver_weather_entity = value.trim() || undefined;
		});
	}

	const BACKGROUNDS = new Set<string>(['image', 'radar', 'photos', 'sun', 'media']);

	function setBackground(value: string) {
		updateConfig((config) => {
			config.screensaver_background = BACKGROUNDS.has(value)
				? (value as ScreensaverBackground)
				: undefined;
		});
	}

	function setPhotos(value: string[]) {
		updateConfig((config) => {
			config.screensaver_photos = value.length ? value : undefined;
		});
	}

	function setPhotoSeconds(value: string) {
		const seconds = integerFromInput(value);
		updateConfig((config) => {
			config.screensaver_photo_seconds =
				seconds === PHOTO_SECONDS.fallback || seconds < PHOTO_SECONDS.min ? undefined : seconds;
		});
	}

	function setPhotoOrder(value: string) {
		updateConfig((config) => {
			config.screensaver_photo_order = value === 'sequence' ? 'sequence' : undefined;
		});
	}

	function setMediaEntity(value: string) {
		updateConfig((config) => {
			config.screensaver_media_entity = value.trim() || undefined;
		});
	}

	function setMediaFallback(value: string) {
		updateConfig((config) => {
			config.screensaver_media_fallback =
				value !== 'media' && BACKGROUNDS.has(value)
					? (value as Exclude<ScreensaverBackground, 'media'>)
					: undefined;
		});
	}

	function setBackgroundImage(value: string) {
		updateConfig((config) => {
			config.screensaver_image = value.trim() || undefined;
		});
	}

	/** Applies a change to the radar settings, dropping keys that are back at their default. */
	function setRadar(patch: Partial<ScreensaverRadar>) {
		updateConfig((config) => {
			const next: ScreensaverRadar = { ...config.screensaver_radar, ...patch };
			if (next.zoom === RADAR_ZOOM.fallback) next.zoom = undefined;
			if (next.basemap === 'dark') next.basemap = undefined;
			const kept = Object.entries(next).filter(([, value]) => value !== undefined);
			config.screensaver_radar = kept.length ? Object.fromEntries(kept) : undefined;
		});
	}

	// turning the home location off starts the fields from the home coordinates
	function setUseHomeLocation(enabled: boolean) {
		const round = (value: number | undefined) =>
			value === undefined ? undefined : Math.round(value * 10_000) / 10_000;
		setRadar(
			enabled
				? { latitude: undefined, longitude: undefined }
				: { latitude: round($haConfig?.latitude), longitude: round($haConfig?.longitude) }
		);
	}

	function setCoordinate(axis: 'latitude' | 'longitude', limit: number, value: string) {
		const coordinate = numberFromInput(value);
		const valid = Number.isFinite(coordinate) && Math.abs(coordinate) <= limit;
		coordinateInvalid[axis] = !valid;
		if (valid) setRadar({ [axis]: coordinate });
	}

	function setTileUrl(value: string) {
		const url = value.trim();
		tileUrlInvalid = url !== '' && !isTileUrl(url);
		if (!tileUrlInvalid) setRadar({ tile_url: url || undefined });
	}

	function setKeepScreenOn(enabled: boolean) {
		updateConfig((config) => {
			config.keep_screen_on = enabled ? undefined : false;
		});
	}

	function setScrollEdgeBlur(enabled: boolean) {
		updateConfig((config) => {
			config.scroll_edge_blur = enabled ? undefined : false;
		});
	}

	function setAnimations(enabled: boolean) {
		updateConfig((config) => {
			config.animations = enabled ? undefined : false;
		});
	}

	let chimes = $derived($hearthConfig.alert_chimes ?? {});
	let chimeVolume = $derived(String(chimes.volume ?? DEFAULT_CHIME_VOLUME));
	let CHIME_SEVERITIES = $derived([
		{ severity: 'info', label: $lang('hearth_alert_chime_info') },
		{ severity: 'warning', label: $lang('hearth_alert_chime_warning') },
		{ severity: 'critical', label: $lang('hearth_alert_chime_critical') }
	] as const);
	let CHIME_OPTIONS = $derived(chimeOptions($lang));
	let VOLUME_OPTIONS = $derived(
		withCurrent(
			['20', '40', '60', '80', '100'].map((value) => ({ value, label: `${value}%` })),
			chimeVolume,
			$lang
		)
	);

	/** Applies a change to the alert chimes, dropping keys that are back at their default. */
	function setChimes(patch: Partial<AlertChimes>) {
		updateConfig((config) => {
			const next: AlertChimes = { ...config.alert_chimes, ...patch };
			if (next.volume === DEFAULT_CHIME_VOLUME) next.volume = undefined;
			const kept = Object.entries(next).filter(([, value]) => value !== undefined);
			config.alert_chimes = kept.length ? Object.fromEntries(kept) : undefined;
		});
	}

	function setSeverityChime(severity: AlertSeverity, value: string) {
		const chime = storedChime(value);
		setChimes({ [severity]: chime === 'none' ? undefined : chime });
	}

	// the tone of the most severe alert that chimes, so the test sounds like one
	let previewTone = $derived.by((): ChimeTone => {
		for (const severity of ['critical', 'warning', 'info'] as const) {
			const chime = chimes[severity];
			if (chime === true) return 'chime';
			if (chime === 'soft' || chime === 'bell') return chime;
		}
		return 'chime';
	});

	async function playTestChime() {
		const { previewChime } = await import('../chimeGate');
		await previewChime(previewTone, Number(chimeVolume));
	}

	let greeting = $derived($hearthConfig.greeting);
	let greetingMinutes = $derived(String(greeting?.minutes ?? GREETING_MINUTES));
	// every person Home Assistant knows, plus any configured one it no longer reports
	let persons = $derived(
		[
			...new Set([
				...Object.keys($states ?? {}).filter((id) => id.startsWith('person.')),
				...(greeting?.persons ?? [])
			])
		].sort()
	);
	let GREETING_MINUTE_OPTIONS = $derived(
		withCurrent(
			['5', '10', '15', '30', '60'].map((value) => ({
				value,
				label: fill($lang('hearth_minutes_count'), { count: value })
			})),
			greetingMinutes,
			$lang
		)
	);

	function setGreetingPerson(person: string, greeted: boolean) {
		updateConfig((config) => {
			const current = config.greeting?.persons ?? [];
			const next = greeted
				? [...new Set([...current, person])]
				: current.filter((entry) => entry !== person);
			config.greeting = next.length ? { ...config.greeting, persons: next } : undefined;
		});
	}

	function setGreetingMinutes(value: string) {
		const minutes = integerFromInput(value);
		updateConfig((config) => {
			if (!config.greeting) return;
			config.greeting = {
				...config.greeting,
				minutes: minutes === GREETING_MINUTES ? undefined : minutes
			};
		});
	}

	function setSwipe(key: 'swipe_navigation_mobile' | 'swipe_navigation_desktop', enabled: boolean) {
		updateConfig((config) => {
			config[key] = enabled ? true : undefined;
		});
	}

	function setPhoneClock(enabled: boolean) {
		updateConfig((config) => {
			config.phone_clock = enabled ? true : undefined;
		});
	}

	type PaddingKey = 'padding_x' | 'padding_y' | 'mobile_padding_x' | 'mobile_padding_y';

	function setPadding(axis: PaddingKey, value: string, shown: number) {
		const pixels = integerFromInput(value);
		storeStepper(
			axis,
			Number.isFinite(pixels) ? Math.min(300, Math.max(0, pixels)) : undefined,
			0,
			shown
		);
	}

	type ScaleKey = 'scale' | 'mobile_scale';

	function setScale(key: ScaleKey, value: string, shown: number) {
		const percent = integerFromInput(value);
		storeStepper(
			key,
			Number.isFinite(percent) ? Math.min(200, Math.max(50, percent)) : undefined,
			100,
			shown
		);
	}

	/**
	 * Undefined clears the key. Tablet rows drop their default; mobile rows keep
	 * any value, since even the default overrides a different tablet value. A
	 * mobile row still following the tablet one stays unset when the press or
	 * typed value lands on the number it already shows.
	 */
	function storeStepper(
		key: PaddingKey | ScaleKey,
		next: number | undefined,
		fallback: number,
		shown: number
	) {
		const mobile = key.startsWith('mobile_');
		if (mobile && $hearthConfig[key] === undefined && next === shown) return;
		updateConfig((config) => {
			config[key] = next === undefined || (!mobile && next === fallback) ? undefined : next;
		});
	}

	interface StepperRow {
		label: string;
		decrease: string;
		increase: string;
		sub?: string;
		value: number;
		step: number;
		min: number;
		max: number;
		unit: string;
		set: (value: string) => void;
	}

	function paddingRow(
		key: PaddingKey,
		value: number,
		labels: Pick<StepperRow, 'label' | 'decrease' | 'increase' | 'sub'>
	): StepperRow {
		return {
			...labels,
			value,
			step: 4,
			min: 0,
			max: 300,
			unit: 'px',
			set: (input) => setPadding(key, input, value)
		};
	}

	function scaleRow(
		key: ScaleKey,
		value: number,
		labels: Pick<StepperRow, 'label' | 'decrease' | 'increase' | 'sub'>
	): StepperRow {
		return {
			...labels,
			// the mobile row's hint is the only place that explains the mobile rows,
			// so the unsupported note goes on the main row alone
			sub:
				// a screen's own scale also applies at narrow widths (see screen.ts)
				$screenOverrides[key] !== undefined ||
				(key === 'mobile_scale' && $screenOverrides.scale !== undefined)
					? 'hearth_this_screen_uses_its_own'
					: zoomSupported || key === 'mobile_scale'
						? labels.sub
						: 'hearth_scale_unsupported',
			value,
			step: 5,
			min: 50,
			max: 200,
			unit: '%',
			set: (input) => setScale(key, input, value)
		};
	}

	let wideRows = $derived([
		scaleRow('scale', scale, {
			label: 'hearth_interface_scale',
			decrease: 'hearth_decrease_interface_scale',
			increase: 'hearth_increase_interface_scale',
			sub: 'hearth_size_of_text_and_controls'
		}),
		paddingRow('padding_x', paddingX, {
			label: 'hearth_side_padding',
			decrease: 'hearth_decrease_side_padding',
			increase: 'hearth_increase_side_padding',
			sub: 'hearth_for_screens_whose_frame_covers_the'
		}),
		paddingRow('padding_y', paddingY, {
			label: 'hearth_top_bottom_padding',
			decrease: 'hearth_decrease_top_bottom_padding',
			increase: 'hearth_increase_top_bottom_padding'
		})
	]);

	// mobile rows follow the wide ones; their hint reads "instead of the values above"
	let narrowRows = $derived([
		scaleRow('mobile_scale', mobileScale, {
			label: 'hearth_mobile_interface_scale',
			decrease: 'hearth_decrease_mobile_interface_scale',
			increase: 'hearth_increase_mobile_interface_scale',
			sub: 'hearth_for_phone_width_screens'
		}),
		paddingRow('mobile_padding_x', mobilePaddingX, {
			label: 'hearth_mobile_side_padding',
			decrease: 'hearth_decrease_mobile_side_padding',
			increase: 'hearth_increase_mobile_side_padding'
		}),
		paddingRow('mobile_padding_y', mobilePaddingY, {
			label: 'hearth_mobile_top_bottom_padding',
			decrease: 'hearth_decrease_mobile_top_bottom_padding',
			increase: 'hearth_increase_mobile_top_bottom_padding'
		})
	]);

	// A typed value that clamps to the stored one changes nothing, so the field
	// would keep showing the typed text; write the effective value back. The
	// row is read through a getter because the object passed in goes stale.
	async function commitInput(input: HTMLInputElement, row: () => StepperRow) {
		row().set(input.value);
		await tick();
		input.value = String(row().value);
	}

	function close() {
		editor.set(null);
	}
</script>

{#snippet stepperRow(row: StepperRow)}
	<SettingsRow label={$lang(row.label)} sub={row.sub && $lang(row.sub)}>
		<span class="unit-input">
			<span class="stepper field-frame">
				<button
					type="button"
					class="step"
					aria-label={$lang(row.decrease)}
					onclick={() => row.set(String(row.value - row.step))}
				>
					<Icon name="remove" size={ICON.inline} />
				</button>
				<input
					type="number"
					aria-label={$lang(row.label)}
					min={row.min}
					max={row.max}
					value={row.value}
					onchange={(event) => commitInput(event.currentTarget, () => row)}
				/>
				<button
					type="button"
					class="step"
					aria-label={$lang(row.increase)}
					onclick={() => row.set(String(row.value + row.step))}
				>
					<Icon name="add" size={ICON.inline} />
				</button>
			</span>
			<span class="unit">{row.unit}</span>
		</span>
	</SettingsRow>
{/snippet}

{#snippet sectionHead(title: string, scope?: string)}
	<div class="section-title">{title}</div>
	{#if scope}<div class="section-scope">{scope}</div>{/if}
{/snippet}

<!-- every row applies as it changes, so the header action only closes -->
<EditSheet
	title={$lang('settings')}
	onclose={close}
	ondone={close}
	doneLabel={$lang('hearth_close')}
>
	<div class="settings">
		<div class="settings-note">{$lang('hearth_settings_note')}</div>

		<section>
			{@render sectionHead($lang('hearth_this_screen'), $lang('hearth_scope_this_browser'))}
			<div class="rows">
				<SettingsRow
					icon="display_settings"
					label={$lang('hearth_this_screen')}
					sub={$lang('hearth_this_screen_sub')}
					onclick={() => screenSheetOpen.set(true)}
				/>
			</div>
		</section>

		<section>
			{@render sectionHead($lang('hearth_appearance'), $lang('hearth_scope_dashboard'))}
			<div class="rows">
				<SettingsRow
					icon="palette"
					label={$lang('theme')}
					sub={$lang('hearth_theme_row_sub')}
					onclick={() => editor.set({ kind: 'theme' })}
				/>
				<SettingsRow
					icon="css"
					label={$lang('hearth_custom_css')}
					sub={$lang('hearth_custom_css_sub')}
					onclick={() => editor.set({ kind: 'customCss' })}
				/>
				<SettingsRow
					label={$lang('hearth_scroll_edge_blur')}
					sub={$lang('hearth_blurs_content_where_a_list_runs_off')}
				>
					<Switch
						checked={scrollEdgeBlur}
						label={$lang('hearth_scroll_edge_blur')}
						onchange={setScrollEdgeBlur}
					/>
				</SettingsRow>
				<SettingsRow
					label={$lang('hearth_tile_animations')}
					sub={$lang('hearth_tile_animations_sub')}
				>
					<Switch
						checked={animations}
						label={$lang('hearth_tile_animations')}
						onchange={setAnimations}
					/>
				</SettingsRow>
			</div>
		</section>

		<section>
			{@render sectionHead($lang('hearth_layout_and_navigation'), $lang('hearth_scope_dashboard'))}
			<div class="rows">
				<SettingsRow
					label={$lang('hearth_sidebar')}
					sub={$lang(
						railPosition === 'none'
							? 'hearth_sidebar_widgets_hidden_but_kept'
							: 'hearth_where_widgets_sit_on_wide_screens'
					)}
				>
					<SelectField
						inline
						label={$lang('hearth_sidebar')}
						value={railPosition}
						options={RAIL_POSITION_OPTIONS}
						onchange={setRailPosition}
					/>
				</SettingsRow>
				<SettingsRow
					label={$lang('hearth_swipe_between_pages_on_phones')}
					sub={$lang('hearth_swipe_sideways_over_the_page')}
				>
					<Switch
						checked={swipeMobile}
						label={$lang('hearth_swipe_between_pages_on_phones')}
						onchange={(enabled) => setSwipe('swipe_navigation_mobile', enabled)}
					/>
				</SettingsRow>
				<SettingsRow
					label={$lang('hearth_swipe_between_pages_on_wide_screens')}
					sub={$lang('hearth_drag_sideways_over_the_page')}
				>
					<Switch
						checked={swipeDesktop}
						label={$lang('hearth_swipe_between_pages_on_wide_screens')}
						onchange={(enabled) => setSwipe('swipe_navigation_desktop', enabled)}
					/>
				</SettingsRow>
				<SettingsRow
					label={$lang('hearth_clock_in_the_phone_page_strip')}
					sub={$lang('hearth_shows_the_time_and_date_beside')}
				>
					<Switch
						checked={phoneClock}
						label={$lang('hearth_clock_in_the_phone_page_strip')}
						onchange={setPhoneClock}
					/>
				</SettingsRow>
			</div>
		</section>

		<section>
			{@render sectionHead($lang('hearth_size_and_spacing'), $lang('hearth_scope_dashboard'))}
			<div class="rows">
				{#each wideRows as row (row.label)}
					{@render stepperRow(row)}
				{/each}
				<div class="group-title">{$lang('hearth_screens_900_px_and_narrower')}</div>
				{#each narrowRows as row (row.label)}
					{@render stepperRow(row)}
				{/each}
			</div>
		</section>

		<section>
			{@render sectionHead($lang('hearth_wall_display'), $lang('hearth_scope_dashboard'))}
			<div class="rows">
				<SettingsRow
					label={$lang('hearth_keep_screen_awake')}
					sub={sharedSub('keep_screen_on', $lang('hearth_while_the_dashboard_is_open'))}
				>
					<Switch
						checked={keepScreenOn}
						label={$lang('hearth_keep_screen_awake')}
						onchange={setKeepScreenOn}
					/>
				</SettingsRow>
				{#if keepScreenOn && ($wakeLockState === 'unsupported' || $wakeLockState === 'denied')}
					<div class="setting-warning" role="alert">
						<Icon name="warning" size={ICON.control} />
						<span>
							{#if $wakeLockState === 'unsupported'}
								{$lang('hearth_screen_wake_lock_is_unavailable_open')}
							{:else}
								{$lang('hearth_the_browser_denied_the_screen_wake')}
							{/if}
						</span>
					</div>
				{/if}
				<SettingsRow label={$lang('hearth_edit_lock')} sub={$lang('hearth_edit_lock_sub')}>
					<SelectField
						inline
						label={$lang('hearth_edit_lock')}
						value={editLock}
						options={EDIT_LOCK_OPTIONS}
						onchange={setEditLock}
					/>
				</SettingsRow>
				{#if editLock === 'pin'}
					<SettingsRow
						label={$lang('hearth_edit_pin')}
						sub={$lang(pinInvalid || !editPin ? 'hearth_edit_pin_invalid' : 'hearth_edit_pin_sub')}
					>
						<input
							class="inline-text"
							type="text"
							inputmode="numeric"
							autocomplete="off"
							maxlength="8"
							aria-label={$lang('hearth_edit_pin')}
							aria-invalid={pinInvalid || undefined}
							value={editPin}
							onchange={(event) => setEditPin(event.currentTarget.value)}
						/>
					</SettingsRow>
				{/if}
				<div class="group-title">{$lang('hearth_sleep_screen')}</div>
				<SettingsRow
					label={$lang('hearth_sleep_turn_on_after')}
					sub={sharedSub('screensaver_minutes')}
				>
					<SelectField
						inline
						label={$lang('hearth_sleep_turn_on_after')}
						value={screensaver}
						options={SCREENSAVER_OPTIONS}
						onchange={setScreensaver}
					/>
				</SettingsRow>
				<SettingsRow
					icon="bedtime"
					label={$lang('hearth_preview_sleep_screen')}
					chevron={false}
					onclick={() => screensaverPreview.set(true)}
				/>
				<SettingsRow label={$lang('hearth_sleep_clock_size')}>
					<SelectField
						inline
						label={$lang('hearth_sleep_clock_size')}
						value={clockSize}
						options={CLOCK_SIZE_OPTIONS}
						onchange={setClockSize}
					/>
				</SettingsRow>
				<SettingsRow label={$lang('hearth_sleep_show_date')}>
					<Switch
						checked={showDate}
						label={$lang('hearth_sleep_show_date')}
						onchange={setShowDate}
					/>
				</SettingsRow>
				<SettingsRow
					label={$lang('hearth_screensaver_drift')}
					sub={$lang('hearth_slowly_moves_the_clock_to_protect')}
				>
					<Switch
						checked={screensaverDrift}
						label={$lang('hearth_screensaver_drift')}
						onchange={setScreensaverDrift}
					/>
				</SettingsRow>
				<SettingsRow label={$lang('hearth_screensaver_brightness')}>
					<SelectField
						inline
						label={$lang('hearth_screensaver_brightness')}
						value={screensaverBrightness}
						options={SCREENSAVER_BRIGHTNESS_OPTIONS}
						onchange={setScreensaverBrightness}
					/>
				</SettingsRow>
				<SettingsRow label={$lang('hearth_sleep_background')}>
					<SelectField
						inline
						label={$lang('hearth_sleep_background')}
						value={background}
						options={BACKGROUND_OPTIONS}
						onchange={setBackground}
					/>
				</SettingsRow>
				{#if background === 'media'}
					<SettingsRow
						label={$lang('hearth_sleep_media_fallback')}
						sub={$lang('hearth_sleep_media_fallback_sub')}
					>
						<SelectField
							inline
							label={$lang('hearth_sleep_media_fallback')}
							value={mediaFallback}
							options={MEDIA_FALLBACK_OPTIONS}
							onchange={setMediaFallback}
						/>
					</SettingsRow>
				{/if}
				{#if scene === 'photos'}
					<SettingsRow label={$lang('hearth_sleep_photo_seconds')}>
						<SelectField
							inline
							label={$lang('hearth_sleep_photo_seconds')}
							value={photoSeconds}
							options={PHOTO_SECONDS_OPTIONS}
							onchange={setPhotoSeconds}
						/>
					</SettingsRow>
					<SettingsRow label={$lang('hearth_sleep_photo_order')}>
						<SelectField
							inline
							label={$lang('hearth_sleep_photo_order')}
							value={photoOrder}
							options={PHOTO_ORDER_OPTIONS}
							onchange={setPhotoOrder}
						/>
					</SettingsRow>
				{/if}
				{#if scene === 'radar'}
					<SettingsRow label={$lang('hearth_sleep_radar_map_style')}>
						<SelectField
							inline
							label={$lang('hearth_sleep_radar_map_style')}
							value={radar.basemap ?? 'dark'}
							options={BASEMAP_OPTIONS}
							onchange={(value) => setRadar({ basemap: value === 'light' ? 'light' : 'dark' })}
						/>
					</SettingsRow>
					<SettingsRow
						label={$lang('hearth_sleep_radar_zoom')}
						sub={$lang('hearth_sleep_radar_zoom_sub')}
					>
						<SelectField
							inline
							label={$lang('hearth_sleep_radar_zoom')}
							value={String(radar.zoom ?? RADAR_ZOOM.fallback)}
							options={ZOOM_OPTIONS}
							onchange={(value) => setRadar({ zoom: integerFromInput(value) })}
						/>
					</SettingsRow>
					{#if homeKnown}
						<SettingsRow
							label={$lang('hearth_sleep_use_home_location')}
							sub={$lang('hearth_sleep_use_home_location_sub')}
						>
							<Switch
								checked={useHomeLocation}
								label={$lang('hearth_sleep_use_home_location')}
								onchange={setUseHomeLocation}
							/>
						</SettingsRow>
					{/if}
					{#if !homeKnown || !useHomeLocation}
						{#each COORDINATES as { axis, label, limit } (axis)}
							<SettingsRow
								{label}
								sub={coordinateInvalid[axis]
									? fill($lang('hearth_sleep_coordinate_invalid'), { limit })
									: undefined}
							>
								<span class="unit-input">
									<span class="stepper field-frame">
										<input
											class="coordinate"
											type="number"
											step="any"
											min={-limit}
											max={limit}
											aria-label={label}
											aria-invalid={coordinateInvalid[axis] || undefined}
											value={radar[axis]}
											onchange={(event) => setCoordinate(axis, limit, event.currentTarget.value)}
										/>
									</span>
								</span>
							</SettingsRow>
						{/each}
					{/if}
				{/if}
				<div class="row-fields">
					{#if background === 'media'}
						<EntityField
							label={$lang('hearth_sleep_media_entity')}
							hint={$lang('hearth_sleep_media_entity_hint')}
							domains={['media_player']}
							value={mediaEntity}
							onchange={setMediaEntity}
						/>
					{/if}
					{#if scene === 'photos'}
						<PhotoListField
							label={$lang('hearth_sleep_photos')}
							hint={$lang('hearth_sleep_photos_hint')}
							value={photos}
							onchange={setPhotos}
						/>
					{/if}
					{#if scene === 'radar'}
						<TextField
							label={$lang('hearth_sleep_tile_url')}
							value={radar.tile_url ?? ''}
							placeholder={OSM_TILES}
							hint={$lang('hearth_sleep_tile_url_hint')}
							error={tileUrlInvalid ? $lang('hearth_sleep_tile_url_invalid') : undefined}
							onchange={setTileUrl}
						/>
						{#if radar.tile_url}
							<TextField
								label={$lang('hearth_sleep_tile_attribution')}
								value={radar.attribution ?? ''}
								onchange={(value) => setRadar({ attribution: value.trim() || undefined })}
							/>
						{/if}
					{/if}
					{#if scene === 'image'}
						<ImageField
							label={$lang('hearth_background_image')}
							value={backgroundImage}
							onchange={setBackgroundImage}
						/>
					{/if}
					<EntityField
						label={$lang('hearth_sleep_weather_entity')}
						hint={$lang('hearth_sleep_weather_entity_hint')}
						domains={['weather']}
						value={weatherEntity}
						onchange={setWeatherEntity}
					/>
				</div>
				<div class="group-title">{$lang('hearth_greeting')}</div>
				{#each persons as person (person)}
					{@const name = $states?.[person]?.attributes?.friendly_name || person}
					<SettingsRow label={fill($lang('hearth_greet_person'), { name })}>
						<Switch
							checked={greeting?.persons.includes(person) ?? false}
							label={fill($lang('hearth_greet_person'), { name })}
							onchange={(greeted) => setGreetingPerson(person, greeted)}
						/>
					</SettingsRow>
				{:else}
					<div class="row-note">{$lang('hearth_greeting_no_persons')}</div>
				{/each}
				{#if greeting}
					<SettingsRow
						label={$lang('hearth_greeting_minutes')}
						sub={$lang('hearth_greeting_minutes_sub')}
					>
						<SelectField
							inline
							label={$lang('hearth_greeting_minutes')}
							value={greetingMinutes}
							options={GREETING_MINUTE_OPTIONS}
							onchange={setGreetingMinutes}
						/>
					</SettingsRow>
				{/if}
			</div>
		</section>

		<section>
			{@render sectionHead($lang('hearth_alerts'), $lang('hearth_scope_dashboard'))}
			<div class="rows">
				{#each $hearthConfig.alerts ?? [] as rule, index (rule.id)}
					<SettingsRow
						icon={rule.icon || 'notifications_active'}
						label={rule.title}
						sub={rule.message}
						onclick={() => editor.set({ kind: 'alert', index })}
					/>
				{/each}
				<SettingsRow
					icon="add"
					label={$lang('hearth_add_alert')}
					sub={$lang('hearth_alerts_sub')}
					onclick={() => editor.set({ kind: 'alert', index: null })}
				/>
				<div class="group-title">{$lang('hearth_alert_chimes')}</div>
				{#each CHIME_SEVERITIES as { severity, label } (severity)}
					<SettingsRow {label}>
						<SelectField
							inline
							{label}
							value={chimeValue(chimes[severity]) || 'none'}
							options={CHIME_OPTIONS}
							onchange={(value) => setSeverityChime(severity, value)}
						/>
					</SettingsRow>
				{/each}
				<SettingsRow label={$lang('hearth_alert_chime_volume')}>
					<SelectField
						inline
						label={$lang('hearth_alert_chime_volume')}
						value={chimeVolume}
						options={VOLUME_OPTIONS}
						onchange={(value) => setChimes({ volume: integerFromInput(value) })}
					/>
				</SettingsRow>
				<SettingsRow
					icon="volume_up"
					label={$lang('hearth_alert_chime_test')}
					sub={$lang(
						$screenOverrides.mute_chimes
							? 'hearth_alert_chime_muted_here'
							: 'hearth_alert_chime_first_tap'
					)}
					chevron={false}
					onclick={playTestChime}
				/>
			</div>
		</section>

		<section>
			{@render sectionHead($lang('hearth_pages'), $lang('hearth_scope_dashboard'))}
			<div class="rows">
				<!-- every page in rail order, reachable whatever the rail shows -->
				{#each $hearthConfig.rooms as room, index (room.id)}
					<div class="page-row">
						<button
							type="button"
							class="page-open"
							onclick={() => editor.set({ kind: 'room', id: room.id })}
						>
							<Icon name={room.icon} size={ICON.control} />
							<span class="page-name">{room.name || room.id}</span>
						</button>
						<button
							type="button"
							class="step"
							aria-label={fill($lang('hearth_move_named_up'), { name: room.name || room.id })}
							disabled={index === 0}
							onclick={() => movePage(index, -1)}
						>
							<Icon name="arrow_upward" size={ICON.control} />
						</button>
						<button
							type="button"
							class="step"
							aria-label={fill($lang('hearth_move_named_down'), { name: room.name || room.id })}
							disabled={index === $hearthConfig.rooms.length - 1}
							onclick={() => movePage(index, 1)}
						>
							<Icon name="arrow_downward" size={ICON.control} />
						</button>
					</div>
				{/each}
				<SettingsRow
					icon="add"
					label={$lang('hearth_add_page')}
					onclick={() => editor.set({ kind: 'room', id: null })}
				/>
				<SettingsRow
					icon="auto_awesome"
					label={$lang('hearth_setup')}
					sub={$lang('hearth_setup_row_sub')}
					onclick={() => setupWizardOpen.set(true)}
				/>
			</div>
		</section>

		<section>
			{@render sectionHead($lang('hearth_server'), $lang('hearth_scope_saved_now'))}
			<div class="rows">
				<SettingsRow
					icon="dns"
					label={$lang('hearth_server_settings')}
					sub={$lang('hearth_server_settings_sub')}
					onclick={() => editor.set({ kind: 'appSettings' })}
				/>
			</div>
		</section>

		<section>
			{@render sectionHead($lang('hearth_maintenance'))}
			<div class="rows">
				<SettingsRow
					icon="code"
					label={$lang('hearth_edit_configuration_yaml')}
					sub={$lang('hearth_edits_the_whole_configuration_as_yaml')}
					onclick={() => editor.set({ kind: 'code', from: { kind: 'settings' } })}
				/>
				<SettingsRow
					icon="history"
					label={$lang('hearth_versions')}
					sub={$lang('hearth_versions_row_sub')}
					onclick={() => editor.set({ kind: 'versions', from: { kind: 'settings' } })}
				/>
			</div>
		</section>
	</div>
</EditSheet>

<style>
	.settings {
		display: flex;
		flex-direction: column;
		gap: 24px;
		max-width: 560px;
		margin: 0 auto;
		width: 100%;
	}

	.section-title {
		font-family: var(--h-font-mono);
		font-size: var(--h-type-label);
		letter-spacing: 2px;
		text-transform: uppercase;
		color: var(--h-label);
		margin: 0 0 4px;
	}

	.section-scope,
	.settings-note,
	.row-note {
		font-size: var(--h-type-small);
		color: var(--h-text-6);
		margin: 0 0 8px;
	}

	.row-note {
		margin: 0;
		padding: 10px 16px 14px;
	}

	/* a run of rows inside a section, set off by its own small heading */
	.group-title {
		padding: 14px 16px 4px;
		border-top: 1px solid rgb(var(--h-line-rgb) / calc(0.06 * var(--h-line-scale)));
		font-family: var(--h-font-mono);
		font-size: var(--h-type-label);
		letter-spacing: 2px;
		text-transform: uppercase;
		color: var(--h-label);
	}

	.inline-text {
		width: 120px;
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.1 * var(--h-line-scale)));
		border-radius: var(--h-radius-xs);
		background: rgb(var(--h-surface-rgb) / calc(0.06 * var(--h-fill-scale)));
		color: var(--h-text-2);
		font-family: var(--h-font-mono);
		font-size: var(--h-type-body);
		padding: 8px 12px;
		outline: none;
	}

	.rows {
		border-radius: var(--h-radius-sm);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.08 * var(--h-line-scale)));
		background: var(--h-track);
		overflow: hidden;
	}

	.row-fields {
		padding: 14px 16px 2px;
		border-top: 1px solid rgb(var(--h-line-rgb) / calc(0.06 * var(--h-line-scale)));
	}

	.unit-input input.coordinate {
		width: 112px;
		padding: 8px 12px;
	}

	.unit-input {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: none;
	}

	/* px and % differ in width; a fixed slot keeps the steppers aligned */
	.unit {
		min-width: 2ch;
		font-size: var(--h-type-secondary);
		color: var(--h-text-6);
	}

	/* minus, value, plus in one bordered group; the native spinner is hidden */
	.stepper {
		display: flex;
		align-items: center;
		border-radius: var(--h-radius-xs);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.1 * var(--h-line-scale)));
		background: rgb(var(--h-surface-rgb) / calc(0.06 * var(--h-fill-scale)));
	}

	.stepper:focus-within {
		border-color: rgb(var(--h-accent-rgb) / calc(0.4 * var(--h-accent-scale)));
	}

	.step {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border: 0;
		background: none;
		color: var(--h-icon);
		cursor: pointer;
	}

	@media (hover: hover) {
		.step:hover {
			color: var(--h-accent-text);
		}
	}

	.unit-input input {
		width: 48px;
		text-align: center;
		padding: 8px 0;
		border: 0;
		background: none;
		color: var(--h-text-2);
		font-family: inherit;
		font-size: var(--h-type-body);
		outline: none;
	}

	/* the native spinner paints white over the dark field and eats the padding */
	.unit-input input[type='number'] {
		appearance: textfield;
		-moz-appearance: textfield;
	}

	.unit-input input::-webkit-outer-spin-button,
	.unit-input input::-webkit-inner-spin-button {
		appearance: none;
		margin: 0;
	}

	.page-row {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 6px 10px 6px 0;
		min-height: 56px;
		border-bottom: 1px solid rgb(var(--h-line-rgb) / calc(0.06 * var(--h-line-scale)));
	}

	.page-open {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 14px;
		align-self: stretch;
		padding: 0 16px;
		border: 0;
		background: none;
		color: var(--h-icon);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.page-name {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-size: var(--h-type-body);
		color: var(--h-text-2);
	}

	@media (hover: hover) {
		.page-open:hover .page-name {
			color: var(--h-accent-text);
		}
	}

	.step:disabled {
		color: var(--h-icon-dim);
		cursor: default;
	}

	.setting-warning {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		padding: 10px 14px;
		border-top: 1px solid rgb(var(--h-bad-rgb) / calc(0.22 * var(--h-accent-scale)));
		background: rgb(var(--h-bad-rgb) / calc(0.06 * var(--h-accent-scale)));
		color: var(--h-bad-text);
		font-size: var(--h-type-small);
		line-height: 1.4;
	}
</style>
