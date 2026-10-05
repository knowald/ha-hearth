<script lang="ts">
	import { untrack } from 'svelte';
	import { fade } from 'svelte/transition';
	import { motion } from '$lib/core/app/motion';
	import { MOTION } from '$lib/core/theme';
	import type { ScreensaverPhotoOrder } from '../config';
	import { sequenceResume, startSlideshow } from './photos';

	/*
	 * A slideshow of uploaded photos behind the sleep screen. Every move is a
	 * CSS animation the compositor runs: the next photo fades in over the last
	 * one, and the one showing slowly zooms. Without motion there is neither,
	 * and while the page is hidden the timer and the zoom both stop.
	 */

	let {
		photos,
		seconds,
		order,
		onready
	}: {
		/** Addresses to load, in configured order. */
		photos: string[];
		seconds: number;
		order: ScreensaverPhotoOrder;
		/** Whether a photo is on screen; false once every photo has failed to load. */
		onready?: (ready: boolean) => void;
	} = $props();

	interface Slide {
		index: number;
		source: string;
	}

	// the zoom starts from a different corner on each photo
	const ORIGINS = ['20% 30%', '80% 70%', '75% 25%', '25% 75%'];

	// a primitive, so an equal list from a config reload keeps the slideshow going
	let playlist = $derived(photos.join('\n'));
	// the last one is on top; the one under it stays until the fade over it ends
	let slides = $state<Slide[]>([]);
	let hidden = $state(typeof document !== 'undefined' && document.hidden);
	let failed: string[] = [];
	let allFailed = $state(false);
	let skip: () => void = () => {};
	let crossfade = $derived($motion ? MOTION.theme * 2 : 0);
	// never restarts, so a slide key is never reused, even across playlist changes
	let shownCount = 0;

	/** Loads and decodes a photo off screen; the element is kept so the decoded image is too. */
	function preload(source: string) {
		const image = new Image();
		image.decoding = 'async';
		image.src = source;
		const decoded =
			typeof image.decode === 'function' ? image.decode().catch(() => {}) : Promise.resolve();
		return { source, image, decoded };
	}

	// runs inside the slideshow effect, which must not come to depend on the slides it sets
	function show(source: string) {
		untrack(() => {
			const slide = { index: shownCount++, source };
			const under = crossfade ? slides.at(-1) : undefined;
			slides = under ? [under, slide] : [slide];
		});
	}

	$effect(() => {
		const list = playlist ? playlist.split('\n') : [];
		const key = playlist;
		failed = [];
		allFailed = false;
		let ahead: ReturnType<typeof preload> | undefined;
		let latest = 0;
		let stopped = false;
		const slideshow = startSlideshow(
			list,
			{ seconds, order, start: order === 'sequence' ? sequenceResume.get(key) : undefined },
			(source, next, position) => {
				if (order === 'sequence') sequenceResume.set(key, (position + 1) % list.length);
				// the photo was loaded ahead; it goes up once decoded, so the fade never stalls
				const pending = ahead?.source === source ? ahead : undefined;
				ahead = next && next !== source ? preload(next) : undefined;
				if (!pending) {
					show(source);
					return;
				}
				const request = ++latest;
				void pending.decoded.then(() => {
					if (!stopped && request === latest) show(source);
				});
			}
		);
		skip = () => slideshow.skip();
		const onvisibility = () => {
			const away = document.hidden;
			hidden = away;
			if (away) slideshow.pause();
			else slideshow.resume();
		};
		onvisibility();
		document.addEventListener('visibilitychange', onvisibility);
		return () => {
			stopped = true;
			slideshow.stop();
			document.removeEventListener('visibilitychange', onvisibility);
		};
	});

	function failedToLoad(source: string) {
		if (!failed.includes(source)) failed.push(source);
		if (photos.every((photo) => failed.includes(photo))) {
			allFailed = true;
			onready?.(false);
		} else {
			skip();
		}
	}

	function settled(slide: Slide) {
		slides = slides.filter((entry) => entry.index >= slide.index);
	}
</script>

<div class="photos" class:paused={hidden} data-testid="photo-frame">
	{#if !allFailed}
		{#each slides as slide (slide.index)}
			<img
				class="slide"
				class:pan={Boolean($motion)}
				src={slide.source}
				alt=""
				decoding="async"
				style:--slide-seconds="{seconds}s"
				style:transform-origin={ORIGINS[slide.index % ORIGINS.length]}
				in:fade={{ duration: crossfade }}
				onintroend={() => settled(slide)}
				onload={() => onready?.(true)}
				onerror={() => failedToLoad(slide.source)}
			/>
		{/each}
	{/if}
</div>

<style>
	.photos {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}

	.slide {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	/* runs past the photo's time, so the pan never stops before the crossfade */
	.slide.pan {
		animation: photo-pan calc(var(--slide-seconds) + 2s) linear forwards; /* literal ok: the crossfade's overlap, not a transition */
		will-change: transform;
	}

	.paused .slide {
		animation-play-state: paused;
	}

	@keyframes photo-pan {
		from {
			transform: scale(1);
		}
		to {
			transform: scale(1.12);
		}
	}
</style>
