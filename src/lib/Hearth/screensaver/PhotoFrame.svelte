<script lang="ts">
	import { fade } from 'svelte/transition';
	import { motion } from '$lib/core/app/motion';
	import { MOTION } from '$lib/core/theme';
	import type { ScreensaverPhotoOrder } from '../config';
	import { startSlideshow } from './photos';

	/*
	 * A slideshow of uploaded photos behind the sleep screen. Every move is a
	 * CSS animation the compositor runs: a crossfade between photos and a slow
	 * pan and zoom on the one showing. Without motion there is neither, and
	 * while the page is hidden the timer and the pan both stop.
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

	// the pan starts from a different corner on each photo
	const ORIGINS = ['20% 30%', '80% 70%', '75% 25%', '25% 75%'];

	// a primitive, so an equal list from a config reload keeps the slideshow going
	let playlist = $derived(photos.join('\n'));
	let slide = $state<{ index: number; source: string }>();
	let hidden = $state(typeof document !== 'undefined' && document.hidden);
	let failed: string[] = [];
	let allFailed = $state(false);
	let skip: () => void = () => {};
	let crossfade = $derived($motion ? MOTION.theme * 2 : 0);

	$effect(() => {
		const list = playlist ? playlist.split('\n') : [];
		failed = [];
		allFailed = false;
		let index = 0;
		const slideshow = startSlideshow(list, { seconds, order }, (source, next) => {
			slide = { index: index++, source };
			// decoded ahead, so the crossfade never waits on the network
			if (next) new Image().src = next;
		});
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
</script>

<div class="photos" class:paused={hidden} data-testid="photo-frame">
	{#if slide && !allFailed}
		{#each [slide] as current (current.index)}
			<img
				class="slide"
				class:pan={Boolean($motion)}
				src={current.source}
				alt=""
				style:--slide-seconds="{seconds}s"
				style:transform-origin={ORIGINS[current.index % ORIGINS.length]}
				in:fade={{ duration: crossfade }}
				out:fade={{ duration: crossfade }}
				onload={() => onready?.(true)}
				onerror={() => failedToLoad(current.source)}
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
