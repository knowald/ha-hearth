import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import LightTile from './LightTile.svelte';

vi.mock('$lib/core/domains/light', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/core/domains/light')>()),
	toggleLight: vi.fn()
}));
import { toggleLight } from '$lib/core/domains/light';

describe('LightTile', () => {
	beforeEach(() => {
		vi.mocked(toggleLight).mockClear();
	});

	it('renders a lit light as a pressed, focusable button with its name', () => {
		states.set({
			'light.desk': hassEntity('light.desk', 'on', { friendly_name: 'Desk', brightness: 128 })
		});
		render(LightTile, { entity: 'light.desk' });
		const tile = screen.getByRole('button');
		expect(screen.getByText('Desk')).toBeTruthy();
		expect(tile.getAttribute('aria-pressed')).toBe('true');
		expect(tile.getAttribute('tabindex')).toBe('0');
	});

	it('renders an unavailable light as unreachable and inert, never as off', () => {
		states.set({ 'light.desk': hassEntity('light.desk', 'unavailable') });
		render(LightTile, { entity: 'light.desk' });
		const tile = screen.getByRole('button');
		expect(tile.classList.contains('unreachable')).toBe(true);
		expect(tile.getAttribute('tabindex')).toBe('-1');
		expect(screen.getByText('Unavailable')).toBeTruthy();
	});

	it('names a missing entity rather than drawing it switched off', () => {
		states.set({});
		render(LightTile, { entity: 'light.gone' });
		expect(screen.getByText('Missing entity')).toBeTruthy();
		expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('false');
	});

	it('toggles from the keyboard', async () => {
		states.set({ 'light.desk': hassEntity('light.desk', 'off') });
		render(LightTile, { entity: 'light.desk' });
		await fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
		expect(toggleLight).toHaveBeenCalledWith('light.desk');
	});

	it('still accepts commands while the light reports unknown', async () => {
		states.set({ 'light.desk': hassEntity('light.desk', 'unknown') });
		render(LightTile, { entity: 'light.desk' });
		const tile = screen.getByRole('button');
		expect(tile.classList.contains('unreachable')).toBe(false);
		await fireEvent.keyDown(tile, { key: 'Enter' });
		expect(toggleLight).toHaveBeenCalledWith('light.desk');
	});

	it('does not send a command while read only', async () => {
		states.set({ 'light.desk': hassEntity('light.desk', 'off') });
		render(LightTile, { entity: 'light.desk', readonly: true });
		const tile = screen.getByRole('button');
		expect(tile.getAttribute('tabindex')).toBe('-1');
		await fireEvent.keyDown(tile, { key: 'Enter' });
		expect(toggleLight).not.toHaveBeenCalled();
	});

	it('treats an on/off-only light as a switch: full fill, On, tap toggles', async () => {
		states.set({
			'light.chamber': hassEntity('light.chamber', 'on', {
				friendly_name: 'Chamber',
				color_mode: 'onoff',
				supported_color_modes: ['onoff']
			})
		});
		const { container } = render(LightTile, { entity: 'light.chamber' });
		const fill = container.querySelector<HTMLElement>('.fill');
		expect(fill?.style.width).toBe('100%');
		expect(screen.getByText('On')).toBeTruthy();
		await fireEvent.click(screen.getByRole('button'));
		expect(toggleLight).toHaveBeenCalledWith('light.chamber');
	});

	it('keeps the brightness fill for a light without supported_color_modes', () => {
		states.set({ 'light.desk': hassEntity('light.desk', 'on', { brightness: 128 }) });
		const { container } = render(LightTile, { entity: 'light.desk' });
		expect(container.querySelector<HTMLElement>('.fill')?.style.width).toBe('50%');
		expect(screen.getByText('50%')).toBeTruthy();
	});
});
