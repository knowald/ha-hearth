import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import { DEFAULT_HEARTH_CONFIG } from './config';
import { resetGreetings } from './greeting';
import Greeting from './Greeting.svelte';
import { hearthConfig } from './store';

const NOW = new Date('2026-10-04T19:30:00Z');

function place(id: string, name: string, state: string) {
	const person = hassEntity(id, state, { friendly_name: name });
	person.last_changed = new Date().toISOString();
	return person;
}

/** Anna and Ben were away when the screen started and have just come home. */
async function arrive() {
	states.set({
		'person.anna': place('person.anna', 'Anna', 'home'),
		'person.ben': place('person.ben', 'Ben', 'home')
	});
	await tick();
}

describe('Greeting', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		hearthConfig.set({
			...structuredClone(DEFAULT_HEARTH_CONFIG),
			// the clock widget's time zone is the dashboard's
			rail: [{ id: 'clock', type: 'clock', timezone: 'Asia/Tokyo' }],
			greeting: { persons: ['person.anna', 'person.ben'] }
		});
		states.set({
			'person.anna': place('person.anna', 'Anna', 'not_home'),
			'person.ben': place('person.ben', 'Ben', 'work')
		});
	});

	afterEach(() => {
		resetGreetings();
		states.set({});
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
		vi.useRealTimers();
	});

	it('greets everyone who just came home for the part of day where the dashboard is', async () => {
		render(Greeting);
		expect(screen.queryByRole('status')).toBeNull();
		await arrive();
		// 19:30 UTC is 04:30 in Tokyo
		expect(screen.getByRole('status').textContent).toContain('Welcome home, Anna and Ben');
	});

	it('greets nobody who was home before the screen saw them away', async () => {
		resetGreetings();
		states.set({
			'person.anna': place('person.anna', 'Anna', 'home'),
			'person.ben': place('person.ben', 'Ben', 'unavailable')
		});
		render(Greeting);
		await arrive();
		expect(screen.queryByRole('status')).toBeNull();
	});

	it('hides once dismissed', async () => {
		render(Greeting);
		await arrive();
		await fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
		expect(screen.queryByRole('status')).toBeNull();
	});

	it('hides by itself after two minutes', async () => {
		render(Greeting);
		await arrive();
		expect(screen.getByRole('status')).toBeTruthy();
		await vi.advanceTimersByTimeAsync(2 * 60_000);
		expect(screen.queryByRole('status')).toBeNull();
	});

	it('leaves dismissing to the wake tap on the sleep screen', async () => {
		render(Greeting, { variant: 'sleep' });
		await arrive();
		expect(screen.getByRole('status')).toBeTruthy();
		expect(screen.queryByRole('button')).toBeNull();
	});
});
