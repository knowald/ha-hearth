<script lang="ts">
	import { fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { motion } from '$lib/core/app/motion';
	import { MOTION } from '$lib/core/theme';
	import { lang } from '$lib/core/i18n';
	import { derived } from 'svelte/store';
	import {
		activeAlerts,
		hearthEditMode,
		screensaverActive,
		screensaverPreview,
		wakeScreen
	} from './store';
	import { layer } from '$lib/ui/layers';
	import { swallowNextClick } from '$lib/ui/gestures';
	import Scene from './screensaver/Scene.svelte';

	// without minutes the screensaver never arms itself and shows only on preview
	let { minutes }: { minutes?: number } = $props();

	let active = $state(false);

	$effect(() => {
		if ($screensaverPreview) active = true;
	});

	$effect(() => {
		screensaverActive.set(active);
		return () => screensaverActive.set(false);
	});

	let lastActivity = Date.now();
	let idleTimer: ReturnType<typeof setTimeout>;
	// an alert card on screen must stay readable, so the idle clock waits for it
	let alertShowing = false;
	// nor does it cover an edit session, whose draft sits unsaved under it
	let editing = false;

	// whether the idle timer is running; awake only, `active` covers asleep
	let idleState = $state<'armed' | 'held' | 'off'>('off');

	function scheduleIdle() {
		clearTimeout(idleTimer);
		if (active || alertShowing || editing || !minutes) {
			if (!active) idleState = minutes ? 'held' : 'off';
			return;
		}
		idleState = 'armed';
		const remaining = Math.max(0, minutes * 60_000 - (Date.now() - lastActivity));
		idleTimer = setTimeout(() => (active = true), remaining);
	}

	/*
	 * Published on <html> for custom CSS and for the browser tests, which can
	 * only tell "stays awake" from "has not loaded yet" by it: armed (the idle
	 * timer runs), held (an alert or an edit session pauses it), off (no
	 * timeout, preview only) or asleep.
	 */
	$effect(() => {
		const root = document.documentElement;
		root.dataset.sleepTimer = active ? 'asleep' : idleState;
		return () => delete root.dataset.sleepTimer;
	});

	// pointermove fires continuously, so cap timestamp writes to one per second
	function recordActivity() {
		const stamp = Date.now();
		if (stamp - lastActivity < 1000) return;
		lastActivity = stamp;
		scheduleIdle();
	}

	// the one way out: every wake source (tap, key, Escape, an alert) ends here. An idle
	// stamp older than the timeout would rearm the screensaver at once.
	function hide() {
		lastActivity = Date.now();
		active = false;
		screensaverPreview.set(false);
		scheduleIdle();
	}

	function dismiss(event: Event) {
		// swallow so the wake tap/keypress never reaches the dashboard
		event.preventDefault();
		event.stopPropagation();
		if (event.type === 'pointerdown') swallowNextClick();
		hide();
	}

	$effect(() => {
		const events = ['pointerdown', 'pointermove', 'keydown', 'touchstart'] as const;
		for (const name of events) window.addEventListener(name, recordActivity, { passive: true });
		scheduleIdle();
		return () => {
			for (const name of events) window.removeEventListener(name, recordActivity);
			clearTimeout(idleTimer);
		};
	});

	// an alert or a popup Home Assistant opened must be seen, so it wakes the
	// screen; the store's current value at subscribe time is not a request
	$effect(() => {
		let initial = true;
		return wakeScreen.subscribe(() => {
			if (!initial) hide();
			initial = false;
		});
	});

	// the idle wait starts over when editing ends, not from the last tap before it
	$effect(() =>
		hearthEditMode.subscribe((next) => {
			if (editing && !next) lastActivity = Date.now();
			editing = next;
			scheduleIdle();
		})
	);

	$effect(() =>
		derived(
			[activeAlerts, hearthEditMode],
			([$alerts, $editing]) => !$editing && $alerts.some((alert) => alert.popup)
		).subscribe((showing) => {
			alertShowing = showing;
			scheduleIdle();
		})
	);
</script>

<!--
	While showing, the screensaver is the top layer: Escape dismisses it instead
	of whatever sheet it covers. It takes focus so keydown targets it rather than
	the dashboard, and hands focus back to where it was on wake.
-->
{#if active}
	<div
		class="screensaver"
		tabindex="-1"
		role="button"
		aria-label={$lang('hearth_dismiss_screensaver')}
		in:fade={{ duration: $motion ? MOTION.theme * 2 : 0, easing: cubicOut }}
		out:fade={{ duration: $motion ? MOTION.fast : 0 }}
		onpointerdown={dismiss}
		onkeydown={dismiss}
		use:layer={{ close: hide, initialFocus: true }}
	>
		<Scene {active} />
	</div>
{/if}

<style>
	.screensaver {
		position: fixed;
		inset: 0;
		z-index: var(--h-layer-screensaver);
		outline: none;
	}
</style>
