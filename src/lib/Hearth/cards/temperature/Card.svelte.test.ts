import { act, render } from '@testing-library/svelte';
import { readable } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import type { TemperatureCard } from './descriptor';
import Card from './Card.svelte';

vi.mock('$lib/core/ha/connection', async (original) => ({
	...(await original<typeof import('$lib/core/ha/connection')>()),
	connected: readable(true)
}));

vi.mock('$lib/core/ha/history', async (original) => ({
	...(await original<typeof import('$lib/core/ha/history')>()),
	startDataRefresh: (load: () => Promise<unknown>, apply: (value: unknown) => void) => {
		void load().then(apply);
		return () => {};
	},
	cachedData: (_key: string, load: () => Promise<unknown>) => load(),
	fetchStatisticSeries: async () => [20, 21.5, 19, 22]
}));

function card(fields: Partial<TemperatureCard> = {}): TemperatureCard {
	return { id: 'temperature', type: 'temperature', entity: 'sensor.living', ...fields };
}

function chartShapes(container: HTMLElement) {
	const circle = container.querySelector('circle');
	return {
		paths: [...container.querySelectorAll('path')].map((path) => path.getAttribute('d')),
		end: [circle?.getAttribute('cx'), circle?.getAttribute('cy')],
		target: container.querySelector('line')?.getAttribute('y1') ?? null
	};
}

describe('temperature card chart', () => {
	it('draws the last day of readings', async () => {
		states.set({ 'sensor.living': hassEntity('sensor.living', '22') });
		const { container } = render(Card, { card: card() });
		await act();
		expect(chartShapes(container)).toMatchInlineSnapshot(`
			{
			  "end": [
			    "520",
			    "8",
			  ],
			  "paths": [
			    "M0.0,57.3 L173.3,20.3 L346.7,82.0 L520.0,8.0 L520,90 L0,90 Z",
			    "M0.0,57.3 L173.3,20.3 L346.7,82.0 L520.0,8.0",
			  ],
			  "target": null,
			}
		`);
	});

	it('widens the scale so the climate target fits and marks it', async () => {
		states.set({
			'sensor.living': hassEntity('sensor.living', '22'),
			'climate.living': hassEntity('climate.living', 'heat', { temperature: 24 })
		});
		const { container } = render(Card, { card: card({ climate_entity: 'climate.living' }) });
		await act();
		expect(chartShapes(container)).toMatchInlineSnapshot(`
			{
			  "end": [
			    "520",
			    "37.6",
			  ],
			  "paths": [
			    "M0.0,67.2 L173.3,45.0 L346.7,82.0 L520.0,37.6 L520,90 L0,90 Z",
			    "M0.0,67.2 L173.3,45.0 L346.7,82.0 L520.0,37.6",
			  ],
			  "target": "8",
			}
		`);
	});
});
