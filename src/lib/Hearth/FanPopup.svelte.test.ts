import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import FanPopup from './FanPopup.svelte';

vi.mock('$lib/core/ha/commands', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/core/ha/commands')>()),
	service: vi.fn()
}));
import { controlOverrides, pendingEntities, service } from '$lib/core/ha/commands';

describe('FanPopup', () => {
	beforeEach(() => {
		vi.mocked(service).mockClear();
		controlOverrides.set({});
		pendingEntities.set({});
	});

	it('selects the pressed speed at once and pulses only that segment', async () => {
		states.set({ 'fan.desk': hassEntity('fan.desk', 'off') });
		render(FanPopup, { entity: 'fan.desk' });
		const low = screen.getByRole('button', { name: 'Low' });
		const off = screen.getByRole('button', { name: 'Off' });
		await fireEvent.click(low);
		expect(service).toHaveBeenCalledWith('fan', 'set_percentage', {
			entity_id: 'fan.desk',
			percentage: 33
		});
		expect(low.classList.contains('active')).toBe(true);
		expect(off.classList.contains('active')).toBe(false);
		expect(low.classList.contains('pending')).toBe(true);
		expect(off.classList.contains('pending')).toBe(false);
	});

	it('pulses a segment pressed from the keyboard too', async () => {
		states.set({ 'fan.desk': hassEntity('fan.desk', 'on', { percentage: 33 }) });
		render(FanPopup, { entity: 'fan.desk' });
		const high = screen.getByRole('button', { name: 'High' });
		await fireEvent.keyDown(high, { key: 'Enter' });
		expect(high.classList.contains('active')).toBe(true);
		expect(high.classList.contains('pending')).toBe(true);
	});
});
