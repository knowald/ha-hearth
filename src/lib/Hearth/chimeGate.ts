import { get } from 'svelte/store';
import { screenOverrides } from '$lib/core/app/screen';
import type { ChimeTone } from './chime';
import type { AlertChime, AlertChimes, AlertRule, AlertSeverity } from './types';

/*
 * When an alert may chime. Browsers refuse to start audio before someone has
 * interacted with the page, so the first tap or key press after load creates
 * and resumes the audio context; until it runs, chimes are skipped, not
 * queued, since a chime for an alert from minutes ago would only confuse.
 * The listeners stay until the context actually runs and come back when the
 * system takes the audio away. The synthesizer in chime.ts loads on the
 * first chime that plays.
 */

// kept in step with DEFAULT_CHIME_VOLUME in model/alerts.ts, see AlertHost for why
const DEFAULT_VOLUME = 60;

/** The tone for an alert: its rule's own chime, else its severity's, else none. */
export function chimeTone(
	chime: AlertChime | undefined,
	severity: AlertSeverity,
	defaults: AlertChimes | undefined
): ChimeTone | undefined {
	const chosen = chime ?? defaults?.[severity];
	if (chosen === true) return 'chime';
	return chosen === 'soft' || chosen === 'bell' ? chosen : undefined;
}

/** Whether any alert could chime, which is when the first tap is worth waiting for. */
export function chimesConfigured(
	rules: AlertRule[] | undefined,
	defaults: AlertChimes | undefined
): boolean {
	const named = (chime: AlertChime | undefined) => chime !== undefined && chime !== 'none';
	return (
		named(defaults?.info) ||
		named(defaults?.warning) ||
		named(defaults?.critical) ||
		(rules ?? []).some((rule) => named(rule.chime))
	);
}

// iOS only unlocks audio from the end of a touch, not its start
const UNLOCK_EVENTS = ['pointerup', 'touchend', 'click', 'keydown'] as const;
// a running context keeps the audio hardware awake, so an idle one is suspended
const IDLE_MS = 500;
// a burst of alerts plays one chime, not a pile of overlapping ones
const MIN_GAP_MS = 1000;

let context: AudioContext | undefined;
let armed = false;
let listening = false;
/** The context has run after a gesture, so it may be resumed without one. */
let unlocked = false;
/** The context is suspended because it went idle, not because the system took it. */
let idle = false;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let lastChime = -Infinity;

function createContext(): AudioContext | undefined {
	const Context =
		globalThis.AudioContext ??
		(globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
	if (!Context) return undefined;
	try {
		context = new Context();
	} catch {
		return undefined;
	}
	// iOS interrupts audio for calls and other apps; the next tap takes it back
	context.onstatechange = () => {
		if (armed && context?.state !== 'running' && !idle) listen(true);
	};
	return context;
}

function listen(on: boolean) {
	if (on === listening) return;
	listening = on;
	for (const name of UNLOCK_EVENTS) {
		if (on) window.addEventListener(name, unlock, { capture: true, passive: true });
		else window.removeEventListener(name, unlock, { capture: true });
	}
}

/** Resumes the context; called inside a gesture, resume() runs before the first await. */
async function resume(): Promise<boolean> {
	if (!context) return false;
	idle = false;
	try {
		await context.resume();
	} catch {
		// refused outside a gesture; the state below says so
	}
	return context.state === 'running';
}

function suspendWhenIdle(delay: number) {
	clearTimeout(idleTimer);
	idleTimer = setTimeout(() => {
		if (context?.state !== 'running') return;
		idle = true;
		void context.suspend().catch(() => {});
	}, delay);
}

async function unlock() {
	if (!context && !createContext()) return;
	if (!(await resume())) return;
	unlocked = true;
	listen(false);
	suspendWhenIdle(IDLE_MS);
}

function handleVisibility() {
	if (document.visibilityState === 'visible' && context?.state !== 'running' && !idle) {
		listen(true);
	}
}

/** Listens for the taps and key presses that unlock audio; returns the stop function. */
export function armChimes(): () => void {
	if (armed) return () => {};
	armed = true;
	if (!unlocked || (context?.state !== 'running' && !idle)) listen(true);
	document.addEventListener('visibilitychange', handleVisibility);
	return () => {
		armed = false;
		listen(false);
		document.removeEventListener('visibilitychange', handleVisibility);
	};
}

export function chimesUnlocked(): boolean {
	return unlocked;
}

/**
 * Plays a tone unless audio is still locked, this screen muted chimes or one
 * played less than a second ago. Resolves to whether it played.
 */
export async function playAlertChime(tone: ChimeTone, volume = DEFAULT_VOLUME): Promise<boolean> {
	if (!context || !unlocked || get(screenOverrides).mute_chimes) return false;
	const now = Date.now();
	if (now - lastChime < MIN_GAP_MS) return false;
	lastChime = now;
	clearTimeout(idleTimer);
	if (context.state !== 'running' && !(await resume())) {
		if (armed) listen(true);
		return false;
	}
	const { playChime } = await import('./chime');
	const end = playChime(context, tone, volume / 100);
	suspendWhenIdle((end - context.currentTime) * 1000 + IDLE_MS);
	return true;
}

/** Plays a tone from a tap in the settings, which itself unlocks audio. */
export async function previewChime(tone: ChimeTone, volume = DEFAULT_VOLUME): Promise<boolean> {
	if (!context && !createContext()) return false;
	if (!(await resume())) return false;
	unlocked = true;
	listen(false);
	return playAlertChime(tone, volume);
}

/** Forgets the audio context and every timer; for tests. */
export function resetChimes() {
	armed = false;
	listen(false);
	document.removeEventListener('visibilitychange', handleVisibility);
	clearTimeout(idleTimer);
	void context?.close?.().catch(() => {});
	context = undefined;
	unlocked = false;
	idle = false;
	lastChime = -Infinity;
}
