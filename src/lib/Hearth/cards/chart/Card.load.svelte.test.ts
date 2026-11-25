import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { english as en } from '$lib/core/i18n/testing';
import Card from './Card.svelte';

const mocks = vi.hoisted(() => ({ loadPlot: vi.fn() }));

vi.mock('./loadPlot', () => ({ loadPlot: mocks.loadPlot }));

describe('chart card plot loading', () => {
	it('says the plot could not load and loads it again on a tap', async () => {
		mocks.loadPlot.mockRejectedValueOnce(new Error('offline'));
		mocks.loadPlot.mockImplementation(() => import('./Plot.svelte'));
		render(Card, { card: { id: 'chart', type: 'chart', entities: [{ entity: 'sensor.a' }] } });
		expect(await screen.findByText(en.hearth_could_not_load_component)).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_retry }));
		// no connection here, so the loaded plot says so
		expect(await screen.findByText(en.hearth_not_connected)).toBeTruthy();
		expect(screen.queryByText(en.hearth_could_not_load_component)).toBeNull();
		expect(mocks.loadPlot).toHaveBeenCalledTimes(2);
	});
});
