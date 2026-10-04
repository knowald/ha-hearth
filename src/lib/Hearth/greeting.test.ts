import { get } from 'svelte/store';
import { afterEach, describe, expect, it } from 'vitest';
import type { HassEntities } from 'home-assistant-js-websocket';
import { hassEntity } from '$lib/core/ha/testing';
import {
	arrivalsToGreet,
	dayPart,
	dismissedGreetings,
	dismissGreeting,
	GREETING_SHOW_MS,
	recentArrivals,
	resetGreetings
} from './greeting';

const NOW = Date.parse('2026-10-04T18:00:00Z');
const MINUTE = 60_000;

function person(id: string, state: string, changedMinutesAgo: number, name?: string) {
	const entity = hassEntity(id, state, name ? { friendly_name: name } : {});
	entity.last_changed = new Date(NOW - changedMinutesAgo * MINUTE).toISOString();
	return entity;
}

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

describe('recentArrivals', () => {
	const states: HassEntities = {
		'person.anna': person('person.anna', 'home', 3, 'Anna'),
		'person.ben': person('person.ben', 'home', 1),
		'person.cleo': person('person.cleo', 'home', 30, 'Cleo'),
		'person.dan': person('person.dan', 'not_home', 1, 'Dan')
	};

	it('lists configured persons who came home within the minutes, earliest first', () => {
		const arrivals = recentArrivals(
			states,
			{ persons: ['person.ben', 'person.anna', 'person.cleo', 'person.dan'] },
			NOW
		);
		expect(arrivals.map((arrival) => arrival.name)).toEqual(['Anna', 'ben']);
	});

	it('widens the window with minutes', () => {
		const arrivals = recentArrivals(states, { persons: ['person.cleo'], minutes: 45 }, NOW);
		expect(arrivals.map((arrival) => arrival.entity)).toEqual(['person.cleo']);
	});

	it('greets nobody without a greeting or states', () => {
		expect(recentArrivals(states, undefined, NOW)).toEqual([]);
		expect(recentArrivals(undefined, { persons: ['person.anna'] }, NOW)).toEqual([]);
	});
});

describe('arrivalsToGreet', () => {
	afterEach(resetGreetings);

	const anna = { entity: 'person.anna', name: 'Anna', at: NOW - 3 * MINUTE };

	it('greets for two minutes from when the screen first showed it', () => {
		expect(arrivalsToGreet([anna], NOW, new Set())).toEqual([anna]);
		expect(arrivalsToGreet([anna], NOW + GREETING_SHOW_MS - 1, new Set())).toEqual([anna]);
		expect(arrivalsToGreet([anna], NOW + GREETING_SHOW_MS, new Set())).toEqual([]);
	});

	it('greets a later arrival of the same person again', () => {
		arrivalsToGreet([anna], NOW, new Set());
		const later = { ...anna, at: NOW + 60 * MINUTE };
		expect(arrivalsToGreet([later], NOW + 61 * MINUTE, new Set())).toEqual([later]);
	});

	it('stops greeting an arrival once dismissed', () => {
		const ben = { entity: 'person.ben', name: 'Ben', at: NOW - MINUTE };
		arrivalsToGreet([anna, ben], NOW, new Set());
		dismissGreeting([anna]);
		expect(arrivalsToGreet([anna, ben], NOW, get(dismissedGreetings))).toEqual([ben]);
	});
});
