import { act, render } from '@testing-library/svelte';
import { readable } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Widget from './Widget.svelte';

const fetchStatistics = vi.hoisted(() => vi.fn());

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
	fetchStatistics
}));

describe('energy widget', () => {
	beforeEach(() => fetchStatistics.mockReset());

	it('asks the recorder for kWh and totals the hours of today', async () => {
		fetchStatistics.mockResolvedValue({
			'sensor.grid': [
				{ start: 0, change: 0.5 },
				{ start: 1, change: 1.25 }
			]
		});
		const { container } = render(Widget, {
			widget: { id: 'energy', type: 'energy', entity: 'sensor.grid', average_badge: false }
		});
		await act();
		expect(fetchStatistics).toHaveBeenCalledWith(
			['sensor.grid'],
			expect.any(Date),
			expect.any(Date),
			'hour',
			{ units: { energy: 'kWh' } }
		);
		expect(container.querySelector('.value')?.textContent).toBe('1.8 kWh');
		expect(container.querySelectorAll('.bar')).toHaveLength(2);
	});
});
