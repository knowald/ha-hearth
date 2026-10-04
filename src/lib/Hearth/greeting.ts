import { writable } from 'svelte/store';
import type { HassEntities } from 'home-assistant-js-websocket';
import { GREETING_MINUTES } from './config';
import type { PresenceGreeting } from './types';

/*
 * The arrival greeting: a person who came home within the configured minutes
 * is greeted for two minutes from when a screen first shows it, or until
 * someone dismisses it. Loaded with Greeting.svelte, only when a greeting is
 * configured. Seen and dismissed arrivals are kept per screen in memory, so
 * every header and the sleep screen agree on them.
 */

export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night';

export const GREETING_SHOW_MS = 2 * 60_000;

/** The part of the day at `date` in the time zone, the browser's when unset. */
export function dayPart(date: Date, timeZone?: string): DayPart {
	const hour = Number(
		new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(date)
	);
	if (hour >= 5 && hour < 12) return 'morning';
	if (hour >= 12 && hour < 17) return 'afternoon';
	if (hour >= 17 && hour < 22) return 'evening';
	return 'night';
}

export interface Arrival {
	entity: string;
	name: string;
	/** When the person's state turned home, in ms. */
	at: number;
}

/** The configured persons who turned home within the greeting's minutes, earliest first. */
export function recentArrivals(
	$states: HassEntities | undefined,
	greeting: PresenceGreeting | undefined,
	now: number
): Arrival[] {
	const window = (greeting?.minutes ?? GREETING_MINUTES) * 60_000;
	return (greeting?.persons ?? [])
		.flatMap((entity): Arrival[] => {
			const person = $states?.[entity];
			if (person?.state !== 'home') return [];
			const at = Date.parse(person.last_changed);
			// a server clock ahead of this one puts the change in the future
			if (!Number.isFinite(at) || now - at > window) return [];
			const name = String(person.attributes?.friendly_name ?? '').trim() || entity.split('.')[1];
			return [{ entity, name, at }];
		})
		.sort((a, b) => a.at - b.at);
}

const arrivalKey = (arrival: Arrival) => `${arrival.entity}@${arrival.at}`;

const firstShown = new Map<string, number>();

export const dismissedGreetings = writable<ReadonlySet<string>>(new Set());

/**
 * The arrivals still to greet at `now`. The two minutes run from when this
 * screen first showed the greeting, not from the arrival, so a screen that
 * loads a few minutes after someone came home still greets them in full.
 */
export function arrivalsToGreet(
	arrivals: Arrival[],
	now: number,
	dismissed: ReadonlySet<string>
): Arrival[] {
	return arrivals.filter((arrival) => {
		const key = arrivalKey(arrival);
		if (dismissed.has(key)) return false;
		const shown = firstShown.get(key) ?? now;
		firstShown.set(key, shown);
		return now - shown < GREETING_SHOW_MS;
	});
}

export function dismissGreeting(arrivals: Arrival[]) {
	dismissedGreetings.update((current) => new Set([...current, ...arrivals.map(arrivalKey)]));
}

/** Forgets what was shown and dismissed; for tests. */
export function resetGreetings() {
	firstShown.clear();
	dismissedGreetings.set(new Set());
}
