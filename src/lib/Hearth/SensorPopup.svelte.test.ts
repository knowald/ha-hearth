import { act, render } from '@testing-library/svelte';
import { readable } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import SensorPopup from './SensorPopup.svelte';

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

describe('sensor popup', () => {
	it('draws the last day of readings', async () => {
		states.set({ 'sensor.living': hassEntity('sensor.living', '22') });
		const { container } = render(SensorPopup, { entity: 'sensor.living' });
		await act();
		const circle = container.querySelector('circle');
		expect({
			paths: [...container.querySelectorAll('path')].map((path) => path.getAttribute('d')),
			end: [circle?.getAttribute('cx'), circle?.getAttribute('cy')]
		}).toMatchInlineSnapshot(`
			{
			  "end": [
			    "520",
			    "10",
			  ],
			  "paths": [
			    "M0.0,70.0 L173.3,25.0 L346.7,100.0 L520.0,10.0 L520,110 L0,110 Z",
			    "M0.0,70.0 L173.3,25.0 L346.7,100.0 L520.0,10.0",
			  ],
			}
		`);
	});
});
