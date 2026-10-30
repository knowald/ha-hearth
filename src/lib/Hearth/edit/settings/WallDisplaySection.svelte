<script module lang="ts">
	import type { HearthConfig } from '../../config';

	/** The dashboard keys this section's rows change. */
	export const SETTING_KEYS = [
		'keep_screen_on',
		'edit_lock',
		'edit_pin',
		'screensaver_minutes',
		'screensaver_show_clock',
		'screensaver_clock_layout',
		'screensaver_clock_font',
		'screensaver_hour_format',
		'screensaver_show_seconds',
		'screensaver_clock_size',
		'screensaver_position_x',
		'screensaver_position_y',
		'screensaver_show_date',
		'screensaver_drift',
		'screensaver_brightness',
		'screensaver_background',
		'screensaver_background_brightness',
		'screensaver_media_fallback',
		'screensaver_photo_seconds',
		'screensaver_photo_order',
		'screensaver_radar',
		'screensaver_media_entity',
		'screensaver_photos',
		'screensaver_image',
		'screensaver_weather_entity',
		'greeting'
	] as const satisfies readonly (keyof HearthConfig)[];
</script>

<script lang="ts">
	import { integerFromInput, numberFromInput } from '../numbers';
	import { ICON } from '../../iconSizes';
	import { fill, lang } from '$lib/core/i18n';
	import { config as haConfig } from '$lib/core/ha/connection';
	import { states } from '$lib/core/ha/entities';
	import { screenOverrides } from '$lib/core/app/screen';
	import {
		GREETING_MINUTES,
		isTileUrl,
		PHOTO_SECONDS,
		RADAR_ZOOM,
		type ScreensaverBackground,
		type ScreensaverRadar
	} from '../../config';
	import { hearthConfig, updateConfig } from '../../store';
	import EntityField from '../EntityField.svelte';
	import Icon from '../../Icon.svelte';
	import ImageField from '../ImageField.svelte';
	import PhotoListField from '../PhotoListField.svelte';
	import SelectField from '../SelectField.svelte';
	import SettingsRow from '../SettingsRow.svelte';
	import SleepPreview from '../SleepPreview.svelte';
	import TextField from '../TextField.svelte';
	import Switch from '../../Switch.svelte';
	import { wakeLockState } from '../../wakeLock';
	import { sleepOptions, withCurrent } from '../options';
	import GroupTitle from './GroupTitle.svelte';
	import NumberStepper from './NumberStepper.svelte';
	import Searchable from './Searchable.svelte';
	import { settingsSearch } from './search.svelte';
	import SettingsSection from './SettingsSection.svelte';

	const search = settingsSearch();
	let previewX = $state<number>();
	let previewY = $state<number>();
	let screensaver = $derived(String($hearthConfig.screensaver_minutes ?? 0));
	let screensaverDrift = $derived($hearthConfig.screensaver_drift ?? false);
	let screensaverBrightness = $derived(String($hearthConfig.screensaver_brightness ?? 32));
	let showDate = $derived($hearthConfig.screensaver_show_date ?? true);
	let showClock = $derived($hearthConfig.screensaver_show_clock ?? true);
	let clockFont = $derived($hearthConfig.screensaver_clock_font ?? 'default');
	let hourFormat = $derived($hearthConfig.screensaver_hour_format ?? 'dashboard');
	let showSeconds = $derived($hearthConfig.screensaver_show_seconds ?? false);
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
	// kept through a search (see SettingsSection keep), so the alert is read once
	let wakeLockWarning = $derived(
		keepScreenOn && ($wakeLockState === 'unsupported' || $wakeLockState === 'denied')
	);

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

	let CLOCK_FONT_OPTIONS = $derived([
		{ value: 'default', label: $lang('hearth_font_default') },
		{ value: 'mono', label: $lang('hearth_font_mono') },
		{ value: 'serif', label: $lang('hearth_font_serif') }
	]);
	let HOUR_FORMAT_OPTIONS = $derived([
		{ value: 'dashboard', label: $lang('hearth_default') },
		{ value: 'auto', label: $lang('hearth_locale_default') },
		{ value: '12', label: $lang('hearth_12_hour') },
		{ value: '24', label: $lang('hearth_24_hour') }
	]);

	function setSleepPercentage(
		key: 'screensaver_position_x' | 'screensaver_position_y' | 'screensaver_background_brightness',
		value: string
	) {
		const parsed = numberFromInput(value);
		if (!Number.isFinite(parsed)) return;
		updateConfig((config) => {
			config[key] = Math.min(100, Math.max(0, Math.round(parsed)));
		});
		previewX = undefined;
		previewY = undefined;
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
</script>

<SettingsSection
	id="wall"
	title={$lang('hearth_wall_display')}
	scope="dashboard"
	clip
	keep={wakeLockWarning}
>
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
	{#if wakeLockWarning}
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
	<div class="sleep-editor">
		<GroupTitle title={$lang('hearth_sleep_screen')} />
		{#if !search?.active}
			<div class="sleep-preview">
				<SleepPreview positionX={previewX} positionY={previewY} />
			</div>
		{/if}
		<SettingsRow label={$lang('hearth_sleep_turn_on_after')} sub={sharedSub('screensaver_minutes')}>
			<SelectField
				inline
				label={$lang('hearth_sleep_turn_on_after')}
				value={screensaver}
				options={SCREENSAVER_OPTIONS}
				onchange={setScreensaver}
			/>
		</SettingsRow>
		<SettingsRow label={$lang('hearth_widget_clock_label')}>
			<Switch
				checked={showClock}
				label={$lang('hearth_widget_clock_label')}
				onchange={(value) =>
					updateConfig((config) => {
						config.screensaver_show_clock = value ? undefined : false;
					})}
			/>
		</SettingsRow>
		{#if showClock}
			<SettingsRow label={$lang('hearth_layout')}>
				<SelectField
					inline
					label={$lang('hearth_layout')}
					value={$hearthConfig.screensaver_clock_layout ?? 'default'}
					options={[
						{ value: 'default', label: $lang('hearth_default') },
						{ value: 'stacked', label: $lang('hearth_stack') }
					]}
					onchange={(value) =>
						updateConfig((config) => {
							config.screensaver_clock_layout = value === 'stacked' ? 'stacked' : undefined;
						})}
				/>
			</SettingsRow>
			<SettingsRow label={$lang('hearth_font')}>
				<SelectField
					inline
					label={$lang('hearth_font')}
					value={clockFont}
					options={CLOCK_FONT_OPTIONS}
					onchange={(value) =>
						updateConfig((config) => {
							config.screensaver_clock_font =
								value === 'mono' || value === 'serif' ? value : undefined;
						})}
				/>
			</SettingsRow>
			<SettingsRow label={$lang('hearth_hour_format')}>
				<SelectField
					inline
					label={$lang('hearth_hour_format')}
					value={hourFormat}
					options={HOUR_FORMAT_OPTIONS}
					onchange={(value) =>
						updateConfig((config) => {
							config.screensaver_hour_format =
								value === 'auto' || value === '12' || value === '24' ? value : undefined;
						})}
				/>
			</SettingsRow>
			<SettingsRow label={$lang('hearth_show_seconds')}>
				<Switch
					checked={showSeconds}
					label={$lang('hearth_show_seconds')}
					onchange={(value) =>
						updateConfig((config) => {
							config.screensaver_show_seconds = value ? true : undefined;
						})}
				/>
			</SettingsRow>
			<SettingsRow label={$lang('hearth_sleep_clock_size')}>
				<SelectField
					inline
					label={$lang('hearth_sleep_clock_size')}
					value={clockSize}
					options={CLOCK_SIZE_OPTIONS}
					onchange={setClockSize}
				/>
			</SettingsRow>
		{/if}
		{#each ['x', 'y'] as axis (axis)}
			{@const key = axis === 'x' ? 'screensaver_position_x' : 'screensaver_position_y'}
			{@const label = `${$lang('hearth_position')} ${axis.toUpperCase()}`}
			<SettingsRow {label}>
				<div class="sleep-range">
					<input
						type="range"
						min="0"
						max="100"
						step="1"
						aria-label={label}
						value={(axis === 'x' ? previewX : previewY) ?? $hearthConfig[key] ?? 50}
						oninput={(event) => {
							if (axis === 'x') previewX = Number(event.currentTarget.value);
							else previewY = Number(event.currentTarget.value);
						}}
						onchange={(event) => setSleepPercentage(key, event.currentTarget.value)}
					/>
					<span>{(axis === 'x' ? previewX : previewY) ?? $hearthConfig[key] ?? 50}%</span>
				</div>
			</SettingsRow>
		{/each}
		<SettingsRow label={$lang('hearth_sleep_show_date')}>
			<Switch checked={showDate} label={$lang('hearth_sleep_show_date')} onchange={setShowDate} />
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
		{#if background !== 'none'}
			<SettingsRow label={$lang('hearth_sleep_background_brightness')}>
				<SelectField
					inline
					label={$lang('hearth_sleep_background_brightness')}
					value={String($hearthConfig.screensaver_background_brightness ?? 'dashboard')}
					options={withCurrent(
						[
							{ value: 'dashboard', label: $lang('hearth_default') },
							...[0, 10, 25, 50, 75, 100].map((value) => ({
								value: String(value),
								label: `${value}%`
							}))
						],
						String($hearthConfig.screensaver_background_brightness ?? 'dashboard'),
						$lang
					)}
					onchange={(value) =>
						value === 'dashboard'
							? updateConfig((config) => {
									config.screensaver_background_brightness = undefined;
								})
							: setSleepPercentage('screensaver_background_brightness', value)}
				/>
			</SettingsRow>
		{/if}
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
						<NumberStepper
							wide
							step="any"
							min={-limit}
							max={limit}
							{label}
							invalid={coordinateInvalid[axis]}
							value={radar[axis]}
							onchange={(input) => setCoordinate(axis, limit, input.value)}
						/>
					</SettingsRow>
				{/each}
			{/if}
		{/if}
		<div class="row-fields">
			{#if background === 'media'}
				<Searchable
					text={[$lang('hearth_sleep_media_entity'), $lang('hearth_sleep_media_entity_hint')]}
				>
					<EntityField
						label={$lang('hearth_sleep_media_entity')}
						hint={$lang('hearth_sleep_media_entity_hint')}
						domains={['media_player']}
						value={mediaEntity}
						onchange={setMediaEntity}
					/>
				</Searchable>
			{/if}
			{#if scene === 'photos'}
				<Searchable text={[$lang('hearth_sleep_photos'), $lang('hearth_sleep_photos_hint')]}>
					<PhotoListField
						label={$lang('hearth_sleep_photos')}
						hint={$lang('hearth_sleep_photos_hint')}
						value={photos}
						onchange={setPhotos}
					/>
				</Searchable>
			{/if}
			{#if scene === 'radar'}
				<Searchable text={[$lang('hearth_sleep_tile_url'), $lang('hearth_sleep_tile_url_hint')]}>
					<TextField
						label={$lang('hearth_sleep_tile_url')}
						value={radar.tile_url ?? ''}
						placeholder={OSM_TILES}
						hint={$lang('hearth_sleep_tile_url_hint')}
						error={tileUrlInvalid ? $lang('hearth_sleep_tile_url_invalid') : undefined}
						onchange={setTileUrl}
					/>
				</Searchable>
				{#if radar.tile_url}
					<Searchable text={[$lang('hearth_sleep_tile_attribution')]}>
						<TextField
							label={$lang('hearth_sleep_tile_attribution')}
							value={radar.attribution ?? ''}
							onchange={(value) => setRadar({ attribution: value.trim() || undefined })}
						/>
					</Searchable>
				{/if}
			{/if}
			{#if scene === 'image'}
				<Searchable text={[$lang('hearth_background_image')]}>
					<ImageField
						label={$lang('hearth_background_image')}
						value={backgroundImage}
						onchange={setBackgroundImage}
					/>
				</Searchable>
			{/if}
			<Searchable
				text={[$lang('hearth_sleep_weather_entity'), $lang('hearth_sleep_weather_entity_hint')]}
			>
				<EntityField
					label={$lang('hearth_sleep_weather_entity')}
					hint={$lang('hearth_sleep_weather_entity_hint')}
					domains={['weather']}
					value={weatherEntity}
					onchange={setWeatherEntity}
				/>
			</Searchable>
		</div>
	</div>
	<GroupTitle title={$lang('hearth_greeting')} />
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
		{#if !search?.active}
			<div class="row-note">{$lang('hearth_greeting_no_persons')}</div>
		{/if}
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
</SettingsSection>

<style>
	.sleep-preview {
		position: sticky;
		top: 0;
		z-index: var(--h-layer-raised);
	}
	/* a pinned preview would cover most of a landscape phone's sheet */
	@media (max-height: 500px) {
		.sleep-preview {
			position: static;
		}
	}
	.sleep-range {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.sleep-range input {
		width: 120px;
		accent-color: var(--h-accent-text);
	}
	.sleep-range span {
		min-width: 4ch;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.row-note {
		font-size: var(--h-type-small);
		color: var(--h-text-6);
		margin: 0;
		padding: 10px 16px 14px;
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

	.row-fields {
		padding: 14px 16px 2px;
		border-top: 1px solid rgb(var(--h-line-rgb) / calc(0.06 * var(--h-line-scale)));
	}

	/* the search can filter out every field */
	.row-fields:not(:has(*)) {
		display: none;
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
