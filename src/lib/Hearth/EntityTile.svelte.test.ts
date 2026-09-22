import { fireEvent, render, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import EntityTile from './EntityTile.svelte';

vi.mock('$lib/core/domains/entity', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/core/domains/entity')>()),
	toggleEntity: vi.fn()
}));
vi.mock('$lib/core/ha/commands', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/core/ha/commands')>()),
	callEntityService: vi.fn()
}));
import { callEntityService } from '$lib/core/ha/commands';
import { dismissConfirmation, popup, requestedConfirmation } from './store';
import { toggleEntity } from '$lib/core/domains/entity';

describe('EntityTile', () => {
	beforeEach(() => {
		vi.mocked(toggleEntity).mockClear();
		vi.mocked(callEntityService).mockClear();
		dismissConfirmation();
		popup.set(null);
	});

	it('toggles a switch on tap', async () => {
		states.set({
			'switch.fan': hassEntity('switch.fan', 'on', { friendly_name: 'Fan' })
		});
		render(EntityTile, { entity: 'switch.fan' });
		const tile = screen.getByRole('button');
		expect(screen.getByText('Fan')).toBeTruthy();
		expect(tile.getAttribute('aria-pressed')).toBe('true');
		await fireEvent.click(tile);
		expect(toggleEntity).toHaveBeenCalledWith('switch.fan');
	});

	it('asks before unlocking a lock instead of sending the command', async () => {
		states.set({
			'lock.front': hassEntity('lock.front', 'locked', { friendly_name: 'Front door' })
		});
		render(EntityTile, { entity: 'lock.front' });
		await fireEvent.click(screen.getByRole('button'));
		expect(toggleEntity).not.toHaveBeenCalled();
		expect(get(requestedConfirmation)?.confirmLabel).toBe('Unlock');
	});

	it('renders an unavailable entity as inert with its availability spelled out', async () => {
		states.set({ 'switch.fan': hassEntity('switch.fan', 'unavailable') });
		render(EntityTile, { entity: 'switch.fan' });
		const tile = screen.getByRole('button');
		expect(tile.getAttribute('tabindex')).toBe('-1');
		expect(tile.classList.contains('unreachable')).toBe(true);
		expect(screen.getByText('Unavailable')).toBeTruthy();
		await fireEvent.click(tile);
		expect(toggleEntity).not.toHaveBeenCalled();
	});

	it('activates a scene that still reports unknown instead of drawing it offline', async () => {
		states.set({ 'scene.movie': hassEntity('scene.movie', 'unknown', { friendly_name: 'Movie' }) });
		render(EntityTile, { entity: 'scene.movie' });
		const tile = screen.getByRole('button');
		expect(tile.getAttribute('tabindex')).toBe('0');
		expect(tile.classList.contains('unreachable')).toBe(false);
		await fireEvent.click(tile);
		expect(toggleEntity).toHaveBeenCalledWith('scene.movie');
	});

	it('keeps a read-only tile out of the tab order and silent on tap', async () => {
		states.set({ 'switch.fan': hassEntity('switch.fan', 'off') });
		render(EntityTile, { entity: 'switch.fan', readonly: true });
		const tile = screen.getByRole('button');
		expect(tile.getAttribute('tabindex')).toBe('-1');
		await fireEvent.click(tile);
		expect(toggleEntity).not.toHaveBeenCalled();
	});

	it('delegates lights and covers to their own tiles', () => {
		states.set({
			'light.desk': hassEntity('light.desk', 'on', { brightness: 255 }),
			'cover.blind': hassEntity('cover.blind', 'open', { current_position: 100 })
		});
		const { container: light } = render(EntityTile, { entity: 'light.desk' });
		expect(light.querySelector('.fill')).not.toBeNull();
		const { container: cover } = render(EntityTile, { entity: 'cover.blind' });
		expect(cover.querySelector('[data-id="cover.blind"]')).not.toBeNull();
	});

	it('locks an unlocked lock without asking, like the detail sheet', async () => {
		states.set({ 'lock.front': hassEntity('lock.front', 'unlocked') });
		render(EntityTile, { entity: 'lock.front' });
		await fireEvent.click(screen.getByRole('button'));
		expect(get(requestedConfirmation)).toBeNull();
		expect(callEntityService).toHaveBeenCalledWith('lock', 'lock', 'lock.front');
	});

	it('opens a numeric sensor on the same detail sheet as search, with its icon', async () => {
		states.set({ 'sensor.temp': hassEntity('sensor.temp', '21.5', { friendly_name: 'Temp' }) });
		render(EntityTile, { entity: 'sensor.temp', icon: 'thermometer' });
		await fireEvent.click(screen.getByRole('button'));
		expect(get(popup)).toMatchObject({
			kind: 'detail',
			entity: 'sensor.temp',
			name: 'Temp',
			icon: 'thermometer'
		});
	});

	it('still opens the history of a read-only reading, since that sends no command', async () => {
		states.set({ 'sensor.temp': hassEntity('sensor.temp', '21.5') });
		render(EntityTile, { entity: 'sensor.temp', readonly: true });
		await fireEvent.click(screen.getByRole('button'));
		expect(get(popup)).toMatchObject({ kind: 'detail', entity: 'sensor.temp' });
	});

	it('shows no tune glyph where the detail sheet would only repeat the tap', () => {
		states.set({
			'switch.pump': hassEntity('switch.pump', 'on'),
			'climate.living': hassEntity('climate.living', 'heat')
		});
		const { container: toggle } = render(EntityTile, { entity: 'switch.pump', showTune: true });
		expect(toggle.querySelector('.tune')).toBeNull();
		const { container: climate } = render(EntityTile, {
			entity: 'climate.living',
			showTune: true
		});
		expect(climate.querySelector('.tune')).not.toBeNull();
	});
});
