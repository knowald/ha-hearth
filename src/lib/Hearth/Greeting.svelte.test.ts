import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import { DEFAULT_HEARTH_CONFIG } from './config';
import { resetGreetings } from './greeting';
import Greeting from './Greeting.svelte';
import { hearthConfig } from './store';

const NOW = new Date('2026-10-04T19:30:00Z');

function arrive(id: string, name: string, minutesAgo: number) {
	const person = hassEntity(id, 'home', { friendly_name: name });
	person.last_changed = new Date(NOW.getTime() - minutesAgo * 60_000).toISOString();
	return person;
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
			'person.anna': arrive('person.anna', 'Anna', 2),
			'person.ben': arrive('person.ben', 'Ben', 1)
		});
	});

	afterEach(() => {
		resetGreetings();
		states.set({});
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
		vi.useRealTimers();
	});

	it('greets everyone who just came home for the part of day where the dashboard is', () => {
		render(Greeting);
		// 19:30 UTC is 04:30 in Tokyo
		expect(screen.getByRole('status').textContent).toContain('Good night, Anna and Ben');
	});

	it('hides once dismissed', async () => {
		render(Greeting);
		await fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
		expect(screen.queryByRole('status')).toBeNull();
	});

	it('hides by itself after two minutes', async () => {
		render(Greeting);
		expect(screen.getByRole('status')).toBeTruthy();
		await vi.advanceTimersByTimeAsync(2 * 60_000);
		expect(screen.queryByRole('status')).toBeNull();
	});

	it('leaves dismissing to the wake tap on the sleep screen', () => {
		render(Greeting, { variant: 'sleep' });
		expect(screen.getByRole('status')).toBeTruthy();
		expect(screen.queryByRole('button')).toBeNull();
	});
});
