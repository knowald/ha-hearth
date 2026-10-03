import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
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
import { callEntityService, controlOverrides } from '$lib/core/ha/commands';
import { dismissConfirmation, popup, requestedConfirmation } from './store';
import { toggleEntity } from '$lib/core/domains/entity';

describe('EntityTile', () => {
	beforeEach(() => {
		vi.mocked(toggleEntity).mockClear();
		vi.mocked(callEntityService).mockClear();
		dismissConfirmation();
		popup.set(null);
		controlOverrides.set({});
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

	it('highlights from a separate status entity while keeping the displayed state', async () => {
		states.set({
			'sensor.washer_display': hassEntity('sensor.washer_display', 'Running · 2h 4m left'),
			'sensor.washer_status': hassEntity('sensor.washer_status', 'running')
		});
		render(EntityTile, {
			entity: 'sensor.washer_display',
			activeEntity: 'sensor.washer_status',
			activeStates: ['running', 'rinsing', 'spinning']
		});
		const tile = screen.getByRole('button');
		expect(screen.getByText('Running · 2h 4m left')).toBeTruthy();
		expect(tile.classList.contains('on')).toBe(true);
		states.set({
			'sensor.washer_display': hassEntity('sensor.washer_display', 'Finished'),
			'sensor.washer_status': hassEntity('sensor.washer_status', 'end')
		});
		await screen.findByText('Finished');
		expect(tile.classList.contains('on')).toBe(false);
	});

	it('highlights from a separate entity by its own on state when no states are listed', async () => {
		states.set({
			'sensor.washer_display': hassEntity('sensor.washer_display', 'Running'),
			'binary_sensor.washer_running': hassEntity('binary_sensor.washer_running', 'on')
		});
		render(EntityTile, {
			entity: 'sensor.washer_display',
			activeEntity: 'binary_sensor.washer_running'
		});
		const tile = screen.getByRole('button');
		expect(tile.classList.contains('on')).toBe(true);
		states.set({
			'sensor.washer_display': hassEntity('sensor.washer_display', 'Idle'),
			'binary_sensor.washer_running': hassEntity('binary_sensor.washer_running', 'off')
		});
		await screen.findByText('Idle');
		expect(tile.classList.contains('on')).toBe(false);
	});

	it('stays dim while the highlight entity is unavailable or missing', async () => {
		states.set({
			'sensor.washer_display': hassEntity('sensor.washer_display', 'Running'),
			'sensor.washer_status': hassEntity('sensor.washer_status', 'unavailable')
		});
		render(EntityTile, {
			entity: 'sensor.washer_display',
			activeEntity: 'sensor.washer_status',
			activeStates: ['running', 'unavailable']
		});
		const tile = screen.getByRole('button');
		expect(tile.classList.contains('on')).toBe(false);
		states.set({ 'sensor.washer_display': hassEntity('sensor.washer_display', 'Spinning') });
		await screen.findByText('Spinning');
		expect(tile.classList.contains('on')).toBe(false);
	});

	it('stays dim while its own entity is unavailable, whatever the highlight entity says', () => {
		states.set({
			'sensor.washer_display': hassEntity('sensor.washer_display', 'unavailable'),
			'sensor.washer_status': hassEntity('sensor.washer_status', 'running')
		});
		render(EntityTile, {
			entity: 'sensor.washer_display',
			activeEntity: 'sensor.washer_status',
			activeStates: ['running']
		});
		expect(screen.getByRole('button').classList.contains('on')).toBe(false);
	});

	it('matches the listed states against its own entity when no highlight entity is set', async () => {
		states.set({ 'sensor.washer': hassEntity('sensor.washer', 'rinsing') });
		render(EntityTile, { entity: 'sensor.washer', activeStates: ['running', 'rinsing'] });
		const tile = screen.getByRole('button');
		expect(tile.classList.contains('on')).toBe(true);
		states.set({ 'sensor.washer': hassEntity('sensor.washer', 'idle') });
		await screen.findByText('Idle');
		expect(tile.classList.contains('on')).toBe(false);
	});

	it('keeps listed states over an optimistic toggle of its own entity', async () => {
		states.set({ 'switch.fan': hassEntity('switch.fan', 'off') });
		render(EntityTile, { entity: 'switch.fan', activeStates: ['off'] });
		const tile = screen.getByRole('button');
		expect(tile.classList.contains('on')).toBe(true);
		controlOverrides.set({ 'active:switch.fan': 1 });
		await tick();
		expect(tile.classList.contains('on')).toBe(true);
		expect(tile.getAttribute('aria-pressed')).toBe('true');
	});

	it('ignores an optimistic toggle of its own entity when another entity highlights it', async () => {
		states.set({
			'switch.fan': hassEntity('switch.fan', 'off'),
			'sensor.fan_mode': hassEntity('sensor.fan_mode', 'idle')
		});
		render(EntityTile, {
			entity: 'switch.fan',
			activeEntity: 'sensor.fan_mode',
			activeStates: ['boost']
		});
		controlOverrides.set({ 'active:switch.fan': 1 });
		await tick();
		const tile = screen.getByRole('button');
		expect(tile.classList.contains('on')).toBe(false);
		// the tap toggled the switch, so its pressed state follows the switch
		expect(tile.getAttribute('aria-pressed')).toBe('true');
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
