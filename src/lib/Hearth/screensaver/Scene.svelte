<script lang="ts">
	import { untrack } from 'svelte';
	import { motion } from '$lib/core/app/motion';
	import { lang, selectedLanguage } from '$lib/core/i18n';
	import { config as haConfig } from '$lib/core/ha/connection';
	import { entityAvailable, states } from '$lib/core/ha/entities';
	import { displayTimeZone, hearthConfig, railClock } from '../store';
	import { clockTimeOptions } from '../clock';
	import { timer } from '$lib/core/app/clock';
	import { imageSource } from '../images';
	import { radarView } from './radar';
	import { PHOTO_SECONDS } from '../config';
	import { holdNowPlaying, nowPlaying, type NowPlaying } from './nowPlaying';
	import { sunSky } from './sun';
	import PhotoFrame from './PhotoFrame.svelte';
	import { conditionIcon } from '../widgets/weather/conditions';
	import Icon from '../Icon.svelte';
	import { ICON } from '../iconSizes';

	// Shared rendering only: the caller owns idle detection, focus and dismissal.
	let {
		active = true,
		positionX,
		positionY
	}: { active?: boolean; positionX?: number; positionY?: number } = $props();
	let activeTimezone = $derived($displayTimeZone);
	let now = $derived($timer);
	let drift = $derived($hearthConfig.screensaver_drift ?? false);
	let brightness = $derived($hearthConfig.screensaver_brightness ?? 32);
	let showDate = $derived($hearthConfig.screensaver_show_date ?? true);
	let showClock = $derived($hearthConfig.screensaver_show_clock ?? true);
	let showSeconds = $derived($hearthConfig.screensaver_show_seconds ?? false);
	let backgroundBrightness = $derived($hearthConfig.screensaver_background_brightness);
	let clockSize = $derived($hearthConfig.screensaver_clock_size ?? 'medium');
	let background = $derived($hearthConfig.screensaver_background ?? 'none');
	let media = $state<NowPlaying>();
	const mediaHold = holdNowPlaying((next) => (media = next));
	$effect(() => mediaHold.stop);
	// only worked out while asleep: awake, every state update would pay for it
	$effect(() => {
		if (!active || background !== 'media') {
			mediaHold.reset();
			return;
		}
		const configured = $hearthConfig.screensaver_media_entity;
		mediaHold.update(
			nowPlaying(
				$states,
				configured,
				untrack(() => media?.entityId)
			)
		);
	});
	// while nothing plays, the media background hands over to its fallback
	let scene = $derived(
		background === 'media' && !media
			? ($hearthConfig.screensaver_media_fallback ?? 'none')
			: background
	);
	let image = $derived(
		scene === 'image' ? imageSource($hearthConfig.screensaver_image) : undefined
	);
	let photos = $derived(
		scene === 'photos'
			? ($hearthConfig.screensaver_photos ?? [])
					.map(imageSource)
					.filter((source) => source !== undefined)
			: []
	);
	let photosReady = $state(false);
	$effect(() => {
		if (!active || !photos.length) photosReady = false;
	});
	let minute = $derived(Math.floor(now.getTime() / 60_000));
	let sunKnown = $derived(Boolean($states?.['sun.sun']));
	// the sky moves once a minute, not on every sun.sun update in between
	let sky = $derived.by(() => {
		if (scene !== 'sun' || !sunKnown) return undefined;
		void minute;
		return untrack(() => sunSky($states?.['sun.sun']));
	});
	let picture = $derived(media?.picture);
	// a failed address stays failed until the art changes or the screen sleeps again
	let failedArt = $state<string>();
	$effect(() => {
		if (!active) failedArt = undefined;
	});
	let art = $derived(picture && picture !== failedArt ? picture : undefined);
	let imageFailed = $state(false);
	$effect(() => {
		// a new image, and every new sleep, gets another chance to load
		void image;
		if (active) imageFailed = false;
	});
	let radarReady = $state(false);
	$effect(() => {
		// the map goes with the overlay, so each sleep waits for frames again
		if (!active || !radar) radarReady = false;
	});
	let radar = $derived(
		scene === 'radar' ? radarView($hearthConfig.screensaver_radar, $haConfig) : undefined
	);
	let weatherId = $derived($hearthConfig.screensaver_weather_entity);
	let weather = $derived(weatherId ? $states?.[weatherId] : undefined);
	let weatherLine = $derived.by(() => {
		if (!weather || !entityAvailable(weather)) return undefined;
		const condition = weather.state;
		const temperature = weather.attributes?.temperature;
		const label = $lang(`weather_${condition.replaceAll('-', '_')}`);
		return {
			icon: conditionIcon(condition),
			text:
				typeof temperature === 'number'
					? `${label} ${Intl.NumberFormat($selectedLanguage).format(Math.round(temperature))}°`
					: label
		};
	});
	// the radar counts once it shows frames; offline it is the plain background
	let hasBackground = $derived(
		Boolean(
			(radar && radarReady) ||
			(image && !imageFailed) ||
			(photos.length && photosReady) ||
			sky ||
			art
		)
	);
	// over a map or photo the dimmest settings would vanish, so text keeps a floor
	let textBrightness = $derived(hasBackground ? Math.max(brightness, 60) : brightness);
	let time = $derived(
		now.toLocaleTimeString(
			$selectedLanguage,
			clockTimeOptions(
				activeTimezone,
				$hearthConfig.screensaver_hour_format ?? $railClock?.hour_format,
				showSeconds
			)
		)
	);
	let timeParts = $derived(
		new Intl.DateTimeFormat(
			$selectedLanguage,
			clockTimeOptions(
				activeTimezone,
				$hearthConfig.screensaver_hour_format ?? $railClock?.hour_format,
				showSeconds
			)
		).formatToParts(now)
	);
	let stacked = $derived($hearthConfig.screensaver_clock_layout === 'stacked');
	let date = $derived(
		now.toLocaleDateString($selectedLanguage, {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			...(activeTimezone ? { timeZone: activeTimezone } : {})
		})
	);
</script>

{#if active}
	<div class="scene">
		<div
			class="backdrop"
			style:--screensaver-brightness={String(
				backgroundBrightness === undefined
					? 0.15 + (0.85 * brightness) / 100
					: backgroundBrightness / 100
			)}
		>
			{#if radar}
				{#await import('./RadarMap.svelte') then RadarMap}
					<RadarMap.default view={radar} onready={(ready) => (radarReady = ready)} />
				{:catch}
					<!-- offline or a failed chunk: the plain background stays -->
				{/await}
			{:else if photos.length}
				<PhotoFrame
					{photos}
					seconds={$hearthConfig.screensaver_photo_seconds ?? PHOTO_SECONDS.fallback}
					order={$hearthConfig.screensaver_photo_order ?? 'shuffle'}
					onready={(ready) => (photosReady = ready)}
				/>
			{:else if sky}
				<div
					class="sky"
					data-phase={sky.phase}
					style:--sky-top={sky.top}
					style:--sky-middle={sky.middle}
					style:--sky-bottom={sky.bottom}
				></div>
			{:else if image && !imageFailed}
				<img
					class="photo"
					src={image}
					alt=""
					decoding="async"
					onerror={() => (imageFailed = true)}
				/>
			{:else if art}
				<img class="art-backdrop" src={art} alt="" decoding="async" />
			{/if}
		</div>
		{#if hasBackground}<div class="scrim"></div>{/if}
		<div class="position-frame">
			<div
				class="content-position"
				style:left={`${positionX ?? $hearthConfig.screensaver_position_x ?? 50}%`}
				style:top={`${positionY ?? $hearthConfig.screensaver_position_y ?? 50}%`}
				style:transform={`translate(-${positionX ?? $hearthConfig.screensaver_position_x ?? 50}%, -${positionY ?? $hearthConfig.screensaver_position_y ?? 50}%)`}
			>
				<div
					class="screensaver-content clock-{clockSize} font-{$hearthConfig.screensaver_clock_font ??
						'default'}"
					class:seconds={showSeconds}
					class:drift={drift && Boolean($motion)}
					style:--screensaver-brightness={String(textBrightness / 100)}
				>
					{#if showClock}
						<div class="clock" class:stacked aria-label={time}>
							{#if stacked}
								{#each timeParts.filter((part) => part.type !== 'literal') as part (part.type)}
									<span class:period={part.type === 'dayPeriod'} aria-hidden="true"
										>{part.value}</span
									>
								{/each}
							{:else}{time}{/if}
						</div>
					{/if}
					{#if showDate}<div class="date">{date}</div>{/if}
					{#if weatherLine}
						<div class="weather">
							<Icon name={weatherLine.icon} size={ICON.control} />
							<span>{weatherLine.text}</span>
						</div>
					{/if}
					{#if media}
						<div class="now-playing">
							{#if art}
								<img class="art" src={art} alt="" onerror={() => (failedArt = art)} />
							{/if}
							<div class="track">
								<div class="track-title">{media.title}</div>
								{#if media.artist}<div class="track-artist">{media.artist}</div>{/if}
							</div>
						</div>
					{/if}
					{#if $hearthConfig.greeting}
						{#await import('../Greeting.svelte') then Greeting}
							<Greeting.default variant="sleep" />
						{/await}
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.scene {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		background: #030201 /* literal ok: pure black for OLED burn-in */;
		font-family: var(--h-font-ui);
		outline: none;
		cursor: default;
	}

	.backdrop {
		position: absolute;
		inset: 0;
		/* the dimmest setting still leaves the map or photo readable */
		opacity: var(--screensaver-brightness);
	}

	.photo {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.sky {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			to bottom,
			var(--sky-top),
			var(--sky-middle) 65%,
			var(--sky-bottom)
		);
	}

	/*
	 * The album art as a wash of its colours: drawn at a tenth of the screen
	 * and scaled up, so the upscale does most of the blurring and the filter
	 * only works on a small box. A little over 10x hides the soft edges.
	 */
	.art-backdrop {
		position: absolute;
		top: 45%;
		left: 45%;
		width: 10%;
		height: 10%;
		object-fit: cover;
		filter: blur(2px) saturate(1.2);
		transform: scale(12);
	}

	/* darkens the middle so the clock reads over a busy map or photo */
	.scrim {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: radial-gradient(
				ellipse at center,
				rgb(0 0 0 / 0.6) 0%,
				rgb(0 0 0 / 0.25) 60%,
				rgb(0 0 0 / 0.1) 100%
			)
			/* literal ok: black scrim over map or photo */;
	}

	/* Reserve room for drift and screen edges even at the extreme positions. */
	.position-frame {
		position: absolute;
		inset: 10%;
	}

	.content-position {
		position: absolute;
		width: max-content;
		max-width: 100%;
	}

	.font-mono .clock {
		font-family: var(--h-font-mono);
	}
	.font-serif .clock {
		font-family: Georgia, 'Times New Roman', serif;
	}

	.screensaver-content {
		/* Independent of transform, so the optional larger clock drift still works. */
		translate: var(--h-shift-x, 0px) var(--h-shift-y, 0px);
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}

	.screensaver-content.drift {
		animation: screensaver-drift 90s ease-in-out infinite alternate; /* literal ok: slow drift period, not a transition */
	}

	.clock {
		font-size: clamp(
			var(--h-type-clock),
			calc(14 * var(--h-vw)),
			160px
		); /* literal ok: scales with the screen */
		font-weight: 600;
		line-height: 1;
		letter-spacing: -4px;
		color: rgb(var(--h-line-rgb) / var(--screensaver-brightness));
	}

	.clock-small .clock {
		font-size: clamp(
			var(--h-type-hero),
			calc(9 * var(--h-vw)),
			104px
		); /* literal ok: scales with the screen */
		letter-spacing: -2px;
	}

	.clock-large .clock {
		font-size: clamp(
			var(--h-type-clock),
			calc(22 * var(--h-vw)),
			260px
		); /* literal ok: scales with the screen */
		letter-spacing: -6px;
	}

	.date {
		font-size: var(--h-type-title);
		margin-top: 18px;
		letter-spacing: 0.2px;
		color: rgb(var(--h-line-rgb) / calc(var(--screensaver-brightness) * 0.75));
	}

	.weather {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 12px;
		font-size: var(--h-type-subtitle);
		color: rgb(var(--h-line-rgb) / calc(var(--screensaver-brightness) * 0.75));
	}

	.now-playing {
		display: flex;
		align-items: center;
		gap: 16px;
		max-width: min(560px, calc(80 * var(--h-vw))); /* literal ok: scales with the screen */
		margin-top: 28px;
	}

	.art {
		flex: none;
		width: clamp(72px, calc(12 * var(--h-vw)), 128px); /* literal ok: scales with the screen */
		aspect-ratio: 1;
		object-fit: cover;
		border-radius: var(--h-radius-xs);
		opacity: calc(0.4 + 0.6 * var(--screensaver-brightness));
	}

	.track {
		min-width: 0;
	}

	.track-title,
	.track-artist {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.track-title {
		font-size: var(--h-type-title);
		font-weight: 600;
		color: rgb(var(--h-line-rgb) / var(--screensaver-brightness));
	}

	.track-artist {
		margin-top: 4px;
		font-size: var(--h-type-subtitle);
		color: rgb(var(--h-line-rgb) / calc(var(--screensaver-brightness) * 0.75));
	}

	.seconds .clock {
		font-size: clamp(
			var(--h-type-hero),
			calc(8 * var(--h-vw)),
			120px
		); /* literal ok: scales with the screen */
	}
	.seconds.clock-small .clock {
		font-size: clamp(
			var(--h-type-title),
			calc(6 * var(--h-vw)),
			80px
		); /* literal ok: scales with the screen */
	}
	.seconds.clock-large .clock {
		font-size: clamp(
			var(--h-type-hero),
			calc(12 * var(--h-vw)),
			180px
		); /* literal ok: scales with the screen */
	}

	.clock.stacked {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}
	.clock.stacked .period {
		font-size: var(--h-type-title);
		letter-spacing: normal;
	}
	/* Stacked digits must fit short landscape screens as well as portrait tablets. */
	.clock.stacked {
		font-size: min(
			calc(14 * var(--h-vw)),
			calc(18 * var(--h-vh))
		); /* literal ok: scales with the screen */
	}
	.clock-small .clock.stacked {
		font-size: min(
			calc(9 * var(--h-vw)),
			calc(12 * var(--h-vh))
		); /* literal ok: scales with the screen */
	}
	.clock-large .clock.stacked {
		font-size: min(
			calc(22 * var(--h-vw)),
			calc(22 * var(--h-vh))
		); /* literal ok: scales with the screen */
	}
	.seconds .clock.stacked {
		font-size: min(
			calc(12 * var(--h-vw)),
			calc(14 * var(--h-vh))
		); /* literal ok: scales with the screen */
	}

	@keyframes screensaver-drift {
		0% {
			transform: translate(calc(-7 * var(--h-vw)), calc(-5 * var(--h-vh)));
		}
		33% {
			transform: translate(calc(6 * var(--h-vw)), calc(-2 * var(--h-vh)));
		}
		66% {
			transform: translate(calc(-3 * var(--h-vw)), calc(6 * var(--h-vh)));
		}
		100% {
			transform: translate(calc(7 * var(--h-vw)), calc(4 * var(--h-vh)));
		}
	}
</style>
