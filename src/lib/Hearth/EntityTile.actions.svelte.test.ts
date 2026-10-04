import { fireEvent, render, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callService, type Connection } from 'home-assistant-js-websocket';
import { connection, health } from '$lib/core/ha/connection';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import { setCommandGate } from '$lib/core/ha/commands';
import { gestureClaimed } from '$lib/ui/gestures';
import { DEFAULT_HEARTH_CONFIG } from './config';
import {
	currentRoom,
	dismissConfirmation,
	hearthConfig,
	hearthEditMode,
	popup,
	requestedConfirmation
} from './store';
import type { HearthAction } from './types';
import EntityTile from './EntityTile.svelte';
import StatTile from './StatTile.svelte';

vi.mock('home-assistant-js-websocket', async (importOriginal) => ({
	...(await importOriginal<typeof import('home-assistant-js-websocket')>()),
	callService: vi.fn(() => Promise.resolve())
}));

const RUN_SCRIPT: HearthAction = {
	action: 'perform-action',
	perform_action: 'script.turn_on',
	target: { entity_id: 'script.goodnight' }
};

function press(target: HTMLElement) {
	fireEvent.pointerDown(target, { clientX: 10, clientY: 10, isPrimary: true, pointerId: 1 });
}

function release(target: HTMLElement) {
	fireEvent.pointerUp(target, { clientX: 10, clientY: 10, isPrimary: true, pointerId: 1 });
	fireEvent.click(target);
}

beforeEach(() => {
	connection.set({} as Connection);
	health.set('connected');
	hearthConfig.set({
		...structuredClone(DEFAULT_HEARTH_CONFIG),
		rooms: [
			{ id: 'home', name: 'Home', icon: 'home', cards: [[]] },
			{ id: 'kitchen', name: 'Kitchen', icon: 'home', cards: [[]] }
		]
	});
	currentRoom.set('home');
	states.set({
		'switch.fan': hassEntity('switch.fan', 'off', { friendly_name: 'Fan' }),
		'sensor.temp': hassEntity('sensor.temp', '21.5', { friendly_name: 'Temp' }),
		'light.desk': hassEntity('light.desk', 'off', { friendly_name: 'Desk' })
	});
});

afterEach(() => {
	vi.useRealTimers();
	vi.clearAllMocks();
	hearthEditMode.set(false);
	setCommandGate(() => true);
	dismissConfirmation();
	popup.set(null);
	connection.set(undefined as unknown as Connection);
	health.set('lost');
});

describe('tile tap and hold actions', () => {
	it('runs a configured tap action instead of toggling', async () => {
		render(EntityTile, { entity: 'switch.fan', tapAction: RUN_SCRIPT });
		await fireEvent.click(screen.getByRole('button'));
		expect(callService).toHaveBeenCalledOnce();
		expect(callService).toHaveBeenCalledWith(
			{},
			'script',
			'turn_on',
			{},
			{
				entity_id: 'script.goodnight'
			}
		);
	});

	it('keeps the domain behaviour without a configured action', async () => {
		render(EntityTile, { entity: 'switch.fan' });
		await fireEvent.click(screen.getByRole('button'));
		expect(callService).toHaveBeenCalledWith(
			{},
			'switch',
			'toggle',
			{ entity_id: 'switch.fan' },
			undefined
		);
	});

	it('fires the hold action at 500ms and swallows the click that follows', async () => {
		vi.useFakeTimers();
		render(EntityTile, {
			entity: 'switch.fan',
			holdAction: { action: 'navigate', navigation_path: 'kitchen' }
		});
		const tile = screen.getByRole('button');
		press(tile);
		vi.advanceTimersByTime(499);
		expect(get(currentRoom)).toBe('home');
		vi.advanceTimersByTime(1);
		expect(get(currentRoom)).toBe('kitchen');
		release(tile);
		expect(callService).not.toHaveBeenCalled();
	});

	it('treats a short press as a tap, not a hold', () => {
		vi.useFakeTimers();
		render(EntityTile, {
			entity: 'switch.fan',
			tapAction: { action: 'none' },
			holdAction: { action: 'navigate', navigation_path: 'kitchen' }
		});
		const tile = screen.getByRole('button');
		press(tile);
		vi.advanceTimersByTime(300);
		release(tile);
		vi.advanceTimersByTime(500);
		expect(get(currentRoom)).toBe('home');
		expect(callService).not.toHaveBeenCalled();
	});

	it('sends no command from a read-only tile, configured or not', async () => {
		render(EntityTile, { entity: 'switch.fan', readonly: true, tapAction: RUN_SCRIPT });
		const tile = screen.getByRole('button');
		expect(tile.getAttribute('tabindex')).toBe('-1');
		await fireEvent.click(tile);
		expect(callService).not.toHaveBeenCalled();
	});

	it('still navigates from a read-only tile', async () => {
		render(EntityTile, {
			entity: 'switch.fan',
			readonly: true,
			tapAction: { action: 'navigate', navigation_path: 'kitchen' }
		});
		const tile = screen.getByRole('button');
		expect(tile.getAttribute('tabindex')).toBe('0');
		await fireEvent.click(tile);
		expect(get(currentRoom)).toBe('kitchen');
	});

	it('reports pressed only while the tap flips the tile itself', () => {
		const { container } = render(EntityTile, {
			entity: 'switch.fan',
			tapAction: { action: 'navigate', navigation_path: 'kitchen' }
		});
		expect(container.querySelector('.tile')!.hasAttribute('aria-pressed')).toBe(false);
		const { container: toggled } = render(EntityTile, {
			entity: 'switch.fan',
			tapAction: { action: 'toggle' }
		});
		expect(toggled.querySelector('.tile')!.getAttribute('aria-pressed')).toBe('false');
	});

	it('keeps the drag off a read-only light, so only its tap action runs', () => {
		vi.useFakeTimers();
		const { container } = render(EntityTile, {
			entity: 'light.desk',
			readonly: true,
			tapAction: { action: 'navigate', navigation_path: 'kitchen' }
		});
		const tile = container.querySelector('.tile') as HTMLElement;
		const down = new Event('pointerdown', { bubbles: true });
		Object.assign(down, { clientX: 10, clientY: 10, isPrimary: true, pointerId: 1, button: 0 });
		tile.dispatchEvent(down);
		expect(gestureClaimed(down)).toBe(false);
		fireEvent.pointerMove(tile, { clientX: 120, clientY: 10, pointerId: 1 });
		fireEvent.pointerUp(tile, { clientX: 120, clientY: 10, pointerId: 1 });
		vi.advanceTimersByTime(1000);
		expect(callService).not.toHaveBeenCalled();
		expect(get(currentRoom)).toBe('home');

		// a slow tap: no hold action, so it stays a tap
		press(tile);
		vi.advanceTimersByTime(800);
		release(tile);
		expect(get(currentRoom)).toBe('kitchen');
	});

	it('lets a long press on a light with hold_action none count as a tap', () => {
		vi.useFakeTimers();
		const { container } = render(EntityTile, {
			entity: 'light.desk',
			holdAction: { action: 'none' }
		});
		const tile = container.querySelector('.tile') as HTMLElement;
		press(tile);
		vi.advanceTimersByTime(800);
		fireEvent.pointerUp(tile, { clientX: 10, clientY: 10, isPrimary: true, pointerId: 1 });
		expect(get(popup)).toBeNull();
		expect(callService).toHaveBeenCalledWith(
			{},
			'light',
			'toggle',
			expect.objectContaining({ entity_id: 'light.desk' }),
			undefined
		);
	});

	it('asks before a confirmed action and sends nothing until accepted', async () => {
		render(EntityTile, {
			entity: 'switch.fan',
			tapAction: { ...RUN_SCRIPT, confirmation: { text: 'Good night?' } }
		});
		await fireEvent.click(screen.getByRole('button'));
		expect(get(requestedConfirmation)?.title).toBe('Good night?');
		expect(callService).not.toHaveBeenCalled();
		get(requestedConfirmation)?.action();
		expect(callService).toHaveBeenCalledOnce();
	});

	it('edits instead of acting in edit mode', async () => {
		hearthEditMode.set(true);
		setCommandGate(() => false);
		const onedit = vi.fn();
		const { container } = render(EntityTile, {
			entity: 'switch.fan',
			tapAction: RUN_SCRIPT,
			onedit
		});
		await fireEvent.click(container.querySelector('.tile')!);
		expect(onedit).toHaveBeenCalledOnce();
		expect(callService).not.toHaveBeenCalled();
	});

	it('runs a tap action from a light tile', async () => {
		render(EntityTile, { entity: 'light.desk', tapAction: { action: 'more-info' } });
		await fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
		expect(get(popup)).toMatchObject({ kind: 'light', entity: 'light.desk' });
		expect(callService).not.toHaveBeenCalled();
	});

	it('runs a tap action from a stat box', async () => {
		render(StatTile, { entity: 'sensor.temp', tapAction: RUN_SCRIPT });
		await fireEvent.click(screen.getByRole('button'));
		expect(callService).toHaveBeenCalledOnce();
		expect(get(popup)).toBeNull();
	});
});
