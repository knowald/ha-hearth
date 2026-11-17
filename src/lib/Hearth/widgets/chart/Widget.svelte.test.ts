import { act, render } from '@testing-library/svelte';
import { readable } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import Widget from './Widget.svelte';

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

describe('chart widget', () => {
	it('draws the recorded series as a line and a filled area', async () => {
		states.set({ 'sensor.power': hassEntity('sensor.power', '22', { unit_of_measurement: 'W' }) });
		const { container } = render(Widget, {
			widget: { id: 'chart', type: 'chart', entity: 'sensor.power', style: 'line' }
		});
		await act();
		const paths = [...container.querySelectorAll('path')].map((path) => path.getAttribute('d'));
		expect(paths).toMatchInlineSnapshot(`
			[
			  "M0.0,38.7 L100.0,12.7 L200.0,56.0 L300.0,4.0 L300,60 L0,60 Z",
			  "M0.0,38.7 L100.0,12.7 L200.0,56.0 L300.0,4.0",
			]
		`);
	});
});
