import { derived, writable } from 'svelte/store';
import type { HassEntities } from 'home-assistant-js-websocket';
import { states } from '$lib/core/ha/entities';
import { GREETING_MINUTES } from './config';
import { hearthConfig } from './store';
import type { PresenceGreeting } from './types';

/*
 * The arrival greeting. A person is greeted when this screen saw them in a
 * real state other than home (not_home, a zone) and then home. Home Assistant
 * sends no previous state with an entity, so a screen that loads, or a Home
 * Assistant restart that passes through unknown or unavailable, greets
 * nobody: whoever is home then simply counts as home. A greeting shows for
 * two minutes from when the screen first shows it, or until dismissed, and a
 * person who flaps between home and away is greeted at most once per window.
 * Arrivals and dismissals are kept per screen, in session storage so a
 * reload in between does not greet twice or bring a dismissed one back.
 * Loaded with Greeting.svelte, only when a greeting is configured.
 */

export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night';

export const GREETING_SHOW_MS = 2 * 60_000;

const NOT_A_PLACE = new Set(['unknown', 'unavailable']);
const STORAGE_KEY = 'hearthGreetings';

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
	/** When this screen first showed the greeting. */
	shown?: number;
	dismissed?: boolean;
}

const lastPlace = new Map<string, string>();
const arrivals = new Map<string, Arrival>(load());

/** Bumped on every dismissal, so greetings on screen redraw at once. */
export const greetingChanges = writable(0);

const windowMs = (greeting: PresenceGreeting | undefined) =>
	(greeting?.minutes ?? GREETING_MINUTES) * 60_000;

function load(): [string, Arrival][] {
	try {
		const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]');
		return Array.isArray(stored)
			? stored
					.filter(
						(arrival) =>
							typeof arrival?.entity === 'string' &&
							typeof arrival.name === 'string' &&
							Number.isFinite(arrival.at)
					)
					.map((arrival: Arrival) => [arrival.entity, arrival])
			: [];
	} catch {
		return [];
	}
}

function save() {
	try {
		if (arrivals.size) sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...arrivals.values()]));
		else sessionStorage.removeItem(STORAGE_KEY);
	} catch {
		// storage blocked: the greetings still hold until the page reloads
	}
}

/** Records the arrivals among the configured persons since the states seen last. */
export function noteStates(
	$states: HassEntities | undefined,
	greeting: PresenceGreeting | undefined,
	now: number
) {
	let changed = false;
	for (const entity of greeting?.persons ?? []) {
		const person = $states?.[entity];
		if (!person) continue;
		const before = lastPlace.get(entity);
		lastPlace.set(entity, person.state);
		if (person.state !== 'home' || !before || before === 'home' || NOT_A_PLACE.has(before)) {
			continue;
		}
		const changedAt = Date.parse(person.last_changed);
		const at = Number.isFinite(changedAt) ? Math.min(changedAt, now) : now;
		const previous = arrivals.get(entity);
		if (previous && at - previous.at < windowMs(greeting)) continue;
		const name = String(person.attributes?.friendly_name ?? '').trim() || entity.split('.')[1];
		arrivals.set(entity, { entity, name, at });
		changed = true;
	}
	if (changed) save();
}

/**
 * The arrivals still to greet at `now`, earliest first. An arrival is
 * forgotten once both its window and its two minutes on screen are over.
 */
export function arrivalsToGreet(greeting: PresenceGreeting | undefined, now: number): Arrival[] {
	const persons = new Set(greeting?.persons ?? []);
	const greet: Arrival[] = [];
	let changed = false;
	for (const [entity, arrival] of arrivals) {
		const over =
			now - arrival.at > windowMs(greeting) &&
			(arrival.shown === undefined || now - arrival.shown >= GREETING_SHOW_MS);
		if (over || !persons.has(entity)) {
			arrivals.delete(entity);
			changed = true;
			continue;
		}
		if (arrival.dismissed) continue;
		if (arrival.shown === undefined) {
			arrival.shown = now;
			changed = true;
		}
		if (now - arrival.shown < GREETING_SHOW_MS) greet.push(arrival);
	}
	if (changed) save();
	return greet.sort((a, b) => a.at - b.at);
}

export function dismissGreeting(greeted: Arrival[]) {
	for (const arrival of greeted) arrival.dismissed = true;
	save();
	greetingChanges.update((count) => count + 1);
}

let watching = false;

/** Follows the configured persons from now on; later calls do nothing. */
export function watchArrivals() {
	if (watching) return;
	watching = true;
	derived([states, hearthConfig], (values) => values).subscribe(([$states, $config]) =>
		noteStates($states, $config.greeting, Date.now())
	);
}

/** Forgets what was seen, shown and dismissed; for tests. */
export function resetGreetings() {
	lastPlace.clear();
	arrivals.clear();
	save();
}
