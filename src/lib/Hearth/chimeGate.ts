import { get } from 'svelte/store';
import { screenOverrides } from '$lib/core/app/screen';
import type { ChimeTone } from './chime';
import type { AlertChime, AlertChimes, AlertRule, AlertSeverity } from './types';

/*
 * When an alert may chime. Browsers refuse to start audio before someone has
 * interacted with the page, so the first tap or key press after load creates
 * the audio context; until then chimes are skipped, not queued, since a
 * chime for an alert from minutes ago would only confuse. The synthesizer in
 * chime.ts loads on the first chime that plays.
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

let context: AudioContext | undefined;
let disarm: (() => void) | undefined;

function createContext(): AudioContext | undefined {
	const Context =
		globalThis.AudioContext ??
		(globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
	if (!Context) return undefined;
	try {
		context = new Context();
		// iOS starts the context suspended even inside the gesture
		void context.resume?.().catch(() => {});
	} catch {
		context = undefined;
	}
	return context;
}

/** Waits for the first tap or key press to unlock audio; returns the stop function. */
export function armChimes(): () => void {
	if (context || disarm) return () => {};
	const events = ['pointerdown', 'keydown'] as const;
	const unlock = () => {
		createContext();
		stop();
	};
	const stop = () => {
		for (const name of events) window.removeEventListener(name, unlock, { capture: true });
		disarm = undefined;
	};
	for (const name of events) {
		window.addEventListener(name, unlock, { capture: true, passive: true });
	}
	disarm = stop;
	return stop;
}

export function chimesUnlocked(): boolean {
	return !!context;
}

/**
 * Plays a tone unless audio is still locked or this screen muted chimes.
 * Resolves to whether it played.
 */
export async function playAlertChime(tone: ChimeTone, volume = DEFAULT_VOLUME): Promise<boolean> {
	if (!context || get(screenOverrides).mute_chimes) return false;
	const { playChime } = await import('./chime');
	playChime(context, tone, volume / 100);
	return true;
}

/** Plays a tone from a tap in the settings, which itself unlocks audio. */
export function previewChime(tone: ChimeTone, volume = DEFAULT_VOLUME): Promise<boolean> {
	if (!context) createContext();
	disarm?.();
	return playAlertChime(tone, volume);
}

/** Forgets the audio context; for tests. */
export function resetChimes() {
	disarm?.();
	void context?.close?.().catch(() => {});
	context = undefined;
}
