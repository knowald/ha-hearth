import { fireEvent, render, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import { closePopup, popup } from './store';
import StatTile from './StatTile.svelte';

describe('StatTile', () => {
	beforeEach(() => closePopup());

	it('renders a numeric reading as a button that opens the same detail sheet as search', async () => {
		states.set({
			'sensor.co2': hassEntity('sensor.co2', '812', {
				friendly_name: 'CO2',
				unit_of_measurement: 'ppm',
				device_class: 'carbon_dioxide'
			})
		});
		render(StatTile, { entity: 'sensor.co2' });
		const tile = screen.getByRole('button');
		expect(tile.textContent).toContain('812');
		expect(tile.textContent).toContain('ppm');
		await fireEvent.click(tile);
		expect(get(popup)).toMatchObject({ kind: 'detail', entity: 'sensor.co2', name: 'CO2' });
	});

	it('opens a read-only sheet for a read-only writable reading', async () => {
		states.set({ 'input_number.volume': hassEntity('input_number.volume', '4', { max: 10 }) });
		render(StatTile, { entity: 'input_number.volume', name: 'Volume', readonly: true });
		await fireEvent.click(screen.getByRole('button'));
		expect(get(popup)).toMatchObject({ kind: 'detail', readonly: true });
	});

	it('renders a non-numeric or unreachable reading as plain text with nothing to open', () => {
		states.set({ 'sensor.mode': hassEntity('sensor.mode', 'unavailable') });
		render(StatTile, { entity: 'sensor.mode', name: 'Mode' });
		expect(screen.queryByRole('button')).toBeNull();
		expect(screen.getByText('Unavailable')).toBeTruthy();
		expect(get(popup)).toBeNull();
	});

	it('formats its reading like every other reading surface', () => {
		states.set({
			'sensor.temp': hassEntity('sensor.temp', '21.04', { unit_of_measurement: '°C' })
		});
		render(StatTile, { entity: 'sensor.temp' });
		expect(screen.getByRole('button').querySelector('.stat-value')?.firstChild?.textContent).toBe(
			'21'
		);
	});
});
