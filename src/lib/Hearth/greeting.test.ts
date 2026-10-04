import { afterEach, describe, expect, it } from 'vitest';
import { hassEntity } from '$lib/core/ha/testing';
import {
	arrivalsToGreet,
	dayPart,
	dismissGreeting,
	GREETING_SHOW_MS,
	noteStates,
	resetGreetings
} from './greeting';

const NOW = Date.parse('2026-10-04T18:00:00Z');
const MINUTE = 60_000;

describe('dayPart', () => {
	it('splits the day into morning, afternoon, evening and night', () => {
		const at = (hour: number) => new Date(Date.UTC(2026, 9, 4, hour, 30));
		expect(dayPart(at(4), 'UTC')).toBe('night');
		expect(dayPart(at(5), 'UTC')).toBe('morning');
		expect(dayPart(at(11), 'UTC')).toBe('morning');
		expect(dayPart(at(12), 'UTC')).toBe('afternoon');
		expect(dayPart(at(16), 'UTC')).toBe('afternoon');
		expect(dayPart(at(17), 'UTC')).toBe('evening');
		expect(dayPart(at(21), 'UTC')).toBe('evening');
		expect(dayPart(at(22), 'UTC')).toBe('night');
		expect(dayPart(at(0), 'UTC')).toBe('night');
	});

	it('reads the hour in the display time zone', () => {
		const moment = new Date('2026-10-04T10:00:00Z');
		expect(dayPart(moment, 'UTC')).toBe('morning');
		expect(dayPart(moment, 'America/Los_Angeles')).toBe('night');
		expect(dayPart(moment, 'Asia/Tokyo')).toBe('evening');
	});
});

const GREETING = { persons: ['person.anna', 'person.ben'] };

/** Feeds one state per person at `at` minutes past NOW, the way the store would. */
function see(at: number, places: Record<string, string>, greeting = GREETING) {
	const time = NOW + at * MINUTE;
	const states = Object.fromEntries(
		Object.entries(places).map(([id, place]) => {
			const entity = hassEntity(id, place, { friendly_name: id === 'person.anna' ? 'Anna' : '' });
			entity.last_changed = new Date(time).toISOString();
			return [id, entity];
		})
	);
	noteStates(states, greeting, time);
	return time;
}

const names = (at: number, greeting = GREETING) =>
	arrivalsToGreet(greeting, NOW + at * MINUTE).map((arrival) => arrival.name);

describe('arrivals', () => {
	afterEach(resetGreetings);

	it('greets a person this screen saw away and then home', () => {
		see(0, { 'person.anna': 'not_home', 'person.ben': 'work' });
		see(1, { 'person.anna': 'home', 'person.ben': 'home' });
		expect(names(1)).toEqual(['Anna', 'ben']);
	});

	it('greets nobody who was already home when the screen started', () => {
		see(0, { 'person.anna': 'home' });
		see(1, { 'person.anna': 'home' });
		expect(names(1)).toEqual([]);
	});

	it('greets nobody coming back from unknown or unavailable, as after a restart', () => {
		see(0, { 'person.anna': 'unavailable', 'person.ben': 'unknown' });
		see(1, { 'person.anna': 'home', 'person.ben': 'home' });
		expect(names(1)).toEqual([]);
	});

	it('ignores persons the greeting does not list', () => {
		const anna = { persons: ['person.anna'] };
		see(0, { 'person.ben': 'not_home' }, anna);
		see(1, { 'person.ben': 'home' }, anna);
		expect(names(1, anna)).toEqual([]);
	});

	it('greets for two minutes from when the greeting first shows', () => {
		see(0, { 'person.anna': 'not_home' });
		see(1, { 'person.anna': 'home' });
		expect(names(3)).toEqual(['Anna']);
		expect(names(3 + GREETING_SHOW_MS / MINUTE - 0.01)).toEqual(['Anna']);
		expect(names(3 + GREETING_SHOW_MS / MINUTE)).toEqual([]);
	});

	it('greets nobody once the window after the arrival has passed unseen', () => {
		see(0, { 'person.anna': 'not_home' });
		see(1, { 'person.anna': 'home' });
		expect(names(12)).toEqual([]);
	});

	it('greets a person who flaps between home and away once per window', () => {
		see(0, { 'person.anna': 'not_home' });
		see(1, { 'person.anna': 'home' });
		expect(names(1)).toEqual(['Anna']);
		dismissGreeting(arrivalsToGreet(GREETING, NOW + MINUTE));
		see(2, { 'person.anna': 'not_home' });
		see(3, { 'person.anna': 'home' });
		expect(names(3)).toEqual([]);
		// a real return later is a new arrival
		see(20, { 'person.anna': 'not_home' });
		see(30, { 'person.anna': 'home' });
		expect(names(30)).toEqual(['Anna']);
	});

	it('keeps arrivals and dismissals in session storage and drops them once over', () => {
		see(0, { 'person.anna': 'not_home' });
		see(1, { 'person.anna': 'home' });
		dismissGreeting(arrivalsToGreet(GREETING, NOW + MINUTE));
		expect(JSON.parse(sessionStorage.getItem('hearthGreetings')!)).toMatchObject([
			{ entity: 'person.anna', dismissed: true }
		]);
		expect(names(2)).toEqual([]);
		names(20);
		expect(sessionStorage.getItem('hearthGreetings')).toBeNull();
	});
});
