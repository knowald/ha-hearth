<script lang="ts">
	import { untrack } from 'svelte';
	import { fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { motion } from '$lib/core/app/motion';
	import { MOTION } from '$lib/core/theme';
	import { lang } from '$lib/core/i18n';
	import { derived } from 'svelte/store';
	import { states } from '$lib/core/ha/entities';
	import {
		activeAlerts,
		hearthEditMode,
		presenceChangesAt,
		screensaverActive,
		sleepNow,
		wakeScreen
	} from './store';
	import { layer } from '$lib/ui/layers';
	import { swallowNextClick } from '$lib/ui/gestures';
	import Scene from './screensaver/Scene.svelte';

	/*
	 * Without minutes the screensaver never arms itself and shows only on
	 * preview. With a presence sensor the screen goes black, or with `dim`
	 * shows a dimmed sleep screen, once the sensor has been off for `delayMs`,
	 * and comes back to the sleep screen (or, without minutes, the dashboard)
	 * once it turns on. Both changes take `fadeMs`.
	 */
	let {
		minutes,
		presence,
		fadeMs = 0,
		delayMs = 0,
		dim = false
	}: {
		minutes?: number;
		presence?: string;
		fadeMs?: number;
		delayMs?: number;
		dim?: boolean;
	} = $props();

	// an awake screen nobody touches goes black this long after the sensor turns off
	const ABSENT_IDLE_MS = 60_000;

	let active = $state(false);
	// showing what nobody-around looks like, plain black or dimmed, instead of the sleep screen
	let blank = $state(false);

	let fadeDuration = $derived($motion ? fadeMs : 0);
	// the sleep screen stays under the blackout while it fades in
	let covering = $state(false);
	let coverTimer: ReturnType<typeof setTimeout>;
	// the sensor, not a tap, ended the blackout, so the wake fades as slowly as it went
	let arrived = $state(false);

	/*
	 * Only on and off are readings: on means someone is around, off for
	 * `delayMs` means nobody is, and anything else (unavailable, unknown, not
	 * loaded yet) leaves the screen as it is. Once nobody is around, only on
	 * ends it, so a longer delay or a restart's fresh last_changed does not wake
	 * the screen. The wait runs from Home Assistant's last_changed, so a reload
	 * does not start it over; a stamp ahead of this clock, or none, counts as now.
	 */
	let reading = $derived(presence ? $states?.[presence]?.state : undefined);
	let offStamp = $derived(
		presence && reading === 'off' ? ($states?.[presence]?.last_changed ?? '') : undefined
	);
	let absent = $state(false);

	$effect(() => {
		if (!presence || reading === 'on') absent = false;
		if (offStamp === undefined) return;
		const now = Date.now();
		const changed = Date.parse(offStamp);
		const changesAt = Math.min(Number.isFinite(changed) ? changed : now, now) + delayMs;
		if (changesAt <= now) {
			absent = true;
			return;
		}
		if (untrack(() => absent)) return;
		presenceChangesAt.set(changesAt);
		const timer = setTimeout(() => (absent = true), changesAt - now);
		return () => {
			clearTimeout(timer);
			presenceChangesAt.set(undefined);
		};
	});

	$effect(() => {
		if (!$sleepNow) return;
		// a sleep action asks for the dashboard to go, not for a lit screen in an empty room
		if ($sleepNow === 'action' && untrack(() => absent)) {
			untrack(blackOut);
			return;
		}
		arrived = false;
		active = true;
		blank = false;
	});

	$effect(() => {
		if (blank) return;
		clearTimeout(coverTimer);
		covering = false;
	});

	$effect(() => () => clearTimeout(coverTimer));

	function blackOut() {
		clearTimeout(idleTimer);
		if (active && !blank && !dim && fadeDuration) {
			covering = true;
			coverTimer = setTimeout(() => (covering = false), fadeDuration);
		}
		arrived = false;
		active = true;
		blank = true;
	}

	/*
	 * One transition both ways, so the sensor flapping mid-fade reverses it
	 * instead of restarting from transparent. Svelte reads these when a fade
	 * starts: in while `active` is already true, out once it is false.
	 */
	const wakeIn = () => (blank ? fadeDuration : $motion ? MOTION.theme * 2 : 0);
	const wakeOut = () => (arrived ? fadeDuration : $motion ? MOTION.fast : 0);

	$effect(() => {
		screensaverActive.set(active);
		return () => screensaverActive.set(false);
	});

	let lastActivity = Date.now();
	// the last touch or key, unlike lastActivity, which waking and loading also set
	let lastInput = -Infinity;
	let idleTimer: ReturnType<typeof setTimeout>;
	// an alert card on screen must stay readable, so the idle clock waits for it
	let alertShowing = false;
	// nor does it cover an edit session, whose draft sits unsaved under it
	let editing = false;

	// whether the idle timer is running; awake only, `active` covers asleep
	let idleState = $state<'armed' | 'held' | 'off'>('off');

	function idleWait() {
		const sleepWait = minutes ? minutes * 60_000 : Infinity;
		return absent ? Math.min(sleepWait, ABSENT_IDLE_MS) : sleepWait;
	}

	function scheduleIdle() {
		clearTimeout(idleTimer);
		const wait = idleWait();
		if (active || alertShowing || editing || wait === Infinity) {
			if (!active) idleState = wait === Infinity ? 'off' : 'held';
			return;
		}
		idleState = 'armed';
		const remaining = Math.max(0, wait - (Date.now() - lastActivity));
		idleTimer = setTimeout(() => {
			arrived = false;
			active = true;
			blank = absent;
		}, remaining);
	}

	/*
	 * Nobody being around blacks or dims the screen out at once, over the sleep
	 * screen too, unless an alert or an edit session holds it, or, with a delay
	 * set, a touch within the last minute; the idle timer then does it a minute
	 * after the last use.
	 * Turning on brings back what was asleep, and the dashboard when the sleep
	 * screen is off and no sleep action asked for it. A preview shows the sleep
	 * screen whatever the sensor says.
	 */
	function presenceChanged(nowAbsent: boolean) {
		if (nowAbsent) {
			// the idle timer only runs awake, so a sleep screen goes dark at once
			const touched = !active && delayMs > 0 && Date.now() - lastInput < ABSENT_IDLE_MS;
			if (alertShowing || editing || touched || $sleepNow === 'preview') scheduleIdle();
			else blackOut();
		} else if (blank) {
			if (minutes || $sleepNow === 'action') blank = false;
			else {
				arrived = true;
				hide();
			}
		} else scheduleIdle();
	}

	$effect(() => {
		const nowAbsent = absent;
		untrack(() => presenceChanged(nowAbsent));
	});

	/*
	 * Published on <html> for custom CSS and for the browser tests, which can
	 * only tell "stays awake" from "has not loaded yet" by it: armed (the idle
	 * timer runs), held (an alert or an edit session pauses it), off (no
	 * timeout, preview only), asleep, blank (black while nobody is around) or
	 * dimmed (the dimmed sleep screen instead).
	 */
	$effect(() => {
		const root = document.documentElement;
		root.dataset.sleepTimer = active ? (blank ? (dim ? 'dimmed' : 'blank') : 'asleep') : idleState;
		return () => delete root.dataset.sleepTimer;
	});

	// pointermove fires continuously, so cap timestamp writes to one per second
	function recordActivity() {
		const stamp = Date.now();
		lastInput = stamp;
		if (stamp - lastActivity < 1000) return;
		lastActivity = stamp;
		scheduleIdle();
	}

	// the one way out: every wake source (tap, key, Escape, an alert) ends here. An idle
	// stamp older than the timeout would rearm the screensaver at once.
	function hide() {
		lastActivity = Date.now();
		active = false;
		blank = false;
		sleepNow.set(false);
		scheduleIdle();
	}

	function dismiss(event: Event) {
		// swallow so the wake tap/keypress never reaches the dashboard
		event.preventDefault();
		event.stopPropagation();
		if (event.type === 'pointerdown') swallowNextClick();
		lastInput = Date.now();
		hide();
	}

	$effect(() => {
		const events = ['pointerdown', 'pointermove', 'keydown', 'touchstart'] as const;
		for (const name of events) window.addEventListener(name, recordActivity, { passive: true });
		untrack(scheduleIdle);
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
			untrack(scheduleIdle);
		})
	);

	$effect(() =>
		derived(
			[activeAlerts, hearthEditMode],
			([$alerts, $editing]) => !$editing && $alerts.some((alert) => alert.popup)
		).subscribe((showing) => {
			alertShowing = showing;
			untrack(scheduleIdle);
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
		transition:fade={{ duration: active ? wakeIn() : wakeOut(), easing: cubicOut }}
		onpointerdown={dismiss}
		onkeydown={dismiss}
		use:layer={{ close: hide, initialFocus: true }}
	>
		{#if !blank || covering || dim}
			<Scene {active} preview={$sleepNow === 'preview'} />
		{/if}
		{#if blank}
			<div class="blackout" class:dim transition:fade={{ duration: fadeDuration }}></div>
		{/if}
	</div>
{/if}

<style>
	.screensaver {
		position: fixed;
		inset: 0;
		z-index: var(--h-layer-screensaver);
		outline: none;
		background: #000 /* literal ok: pure black for OLED, every pixel off */;
	}

	.blackout {
		position: absolute;
		inset: 0;
		background: #000 /* literal ok: pure black for OLED, every pixel off */;
	}

	/* the fade runs to this opacity, leaving the sleep screen at a third of its brightness */
	.blackout.dim {
		opacity: 0.67;
	}
</style>
