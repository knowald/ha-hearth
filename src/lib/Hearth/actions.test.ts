import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import { DEFAULT_HEARTH_CONFIG, resolvePage } from './config';
import {
	currentRoom,
	dismissConfirmation,
	hearthConfig,
	popup,
	requestedConfirmation
} from './store';

vi.mock('$lib/core/domains/entity', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/core/domains/entity')>()),
	toggleEntity: vi.fn(() => true),
	toggleDevice: vi.fn()
}));
import { toggleEntity } from '$lib/core/domains/entity';
import { actionRuns, customAction, runSurfaceAction, tapToggles } from './actions';

const ROOMS = [
	{ id: 'home', name: 'Home' },
	{ id: 'kitchen', name: 'Kitchen' },
	{ id: 'page-2', name: 'Living room' }
];

beforeEach(() => {
	hearthConfig.set({
		...structuredClone(DEFAULT_HEARTH_CONFIG),
		rooms: ROOMS.map((room) => ({ ...room, icon: 'home', cards: [[]] }))
	});
	currentRoom.set('home');
	states.set({
		'lock.front': hassEntity('lock.front', 'locked', { friendly_name: 'Front door' }),
		'cover.garage': hassEntity('cover.garage', 'closed', {
			friendly_name: 'Garage',
			device_class: 'garage'
		}),
		'switch.fan': hassEntity('switch.fan', 'off', { friendly_name: 'Fan' })
	});
});

afterEach(() => {
	vi.clearAllMocks();
	dismissConfirmation();
	popup.set(null);
});

describe('resolvePage', () => {
	it('finds a page by id, by name or by the last segment of a Lovelace path', () => {
		expect(resolvePage(ROOMS, 'kitchen')).toBe('kitchen');
		expect(resolvePage(ROOMS, 'living room')).toBe('page-2');
		expect(resolvePage(ROOMS, '/lovelace/kitchen')).toBe('kitchen');
		expect(resolvePage(ROOMS, '/dashboard-home/kitchen?edit=1')).toBe('kitchen');
		expect(resolvePage(ROOMS, '/lovelace/garage')).toBeUndefined();
	});
});

describe('customAction', () => {
	it('counts everything but default and unset', () => {
		expect(customAction(undefined)).toBe(false);
		expect(customAction({ action: 'default' })).toBe(false);
		expect(customAction({ action: 'none' })).toBe(true);
	});
});

describe('runSurfaceAction', () => {
	it('switches pages for navigate and ignores an unknown page', () => {
		const surface = { entity: 'switch.fan', fallback: vi.fn() };
		runSurfaceAction({ action: 'navigate', navigation_path: '/lovelace/kitchen' }, surface);
		expect(get(currentRoom)).toBe('kitchen');
		runSurfaceAction({ action: 'navigate', navigation_path: 'garage' }, surface);
		expect(get(currentRoom)).toBe('kitchen');
	});

	it('does not navigate to a page its visibility conditions hide', () => {
		hearthConfig.update((config) => {
			config.rooms[2].visibility = [{ entity: 'input_boolean.guests', state: 'on' }];
			return config;
		});
		currentRoom.set('kitchen');
		const surface = { entity: 'switch.fan', fallback: vi.fn() };
		runSurfaceAction({ action: 'navigate', navigation_path: 'living room' }, surface);
		expect(get(currentRoom)).toBe('kitchen');
		runSurfaceAction({ action: 'navigate', navigation_path: 'home' }, surface);
		expect(get(currentRoom)).toBe('home');
	});

	it('opens the detail popup with the surface name and options for more-info', () => {
		runSurfaceAction(
			{ action: 'more-info' },
			{ entity: 'switch.fan', name: 'Ceiling fan', detail: { readonly: true }, fallback: vi.fn() }
		);
		expect(get(popup)).toMatchObject({ entity: 'switch.fan', name: 'Ceiling fan', readonly: true });
	});

	it('asks with the configured question and runs only once accepted', () => {
		runSurfaceAction(
			{ action: 'toggle', confirmation: { text: 'Turn the fan on?' } },
			{ entity: 'switch.fan', fallback: vi.fn() }
		);
		const request = get(requestedConfirmation);
		expect(request).toMatchObject({
			title: 'Turn the fan on?',
			message: 'Fan',
			confirmLabel: 'Toggle'
		});
		expect(toggleEntity).not.toHaveBeenCalled();
		request?.action();
		expect(toggleEntity).toHaveBeenCalledWith('switch.fan');
	});

	it('names the confirm button after what the action does', () => {
		const surface = { fallback: vi.fn() };
		const labels = [
			[{ action: 'perform-action', perform_action: 'script.turn_on' }, 'Run'],
			[{ action: 'navigate', navigation_path: 'kitchen' }, 'Go'],
			[{ action: 'url', url_path: '/local/a.html' }, 'Open']
		] as const;
		for (const [action, label] of labels) {
			runSurfaceAction({ ...action, confirmation: true }, surface);
			expect(get(requestedConfirmation)).toMatchObject({
				title: 'Are you sure?',
				// no name and no entity: a plain sentence, never an entity id
				message: 'This runs the action set for this tile.',
				confirmLabel: label
			});
		}
	});

	it('keeps the unlock question for a toggle action on a lock', () => {
		runSurfaceAction({ action: 'toggle' }, { entity: 'lock.front', fallback: vi.fn() });
		expect(get(requestedConfirmation)?.confirmLabel).toBe('Unlock');
		expect(toggleEntity).not.toHaveBeenCalled();
	});

	it('asks once, not twice, where the lock or garage door asks anyway', () => {
		runSurfaceAction(
			{ action: 'toggle', confirmation: true },
			{ entity: 'lock.front', fallback: vi.fn() }
		);
		expect(get(requestedConfirmation)?.confirmLabel).toBe('Unlock');
		dismissConfirmation();

		const fallback = vi.fn();
		runSurfaceAction(
			{ action: 'default', confirmation: true },
			{ entity: 'cover.garage', fallbackToggles: true, fallback }
		);
		expect(fallback).toHaveBeenCalledOnce();
		expect(get(requestedConfirmation)).toBeNull();

		// the same default on a surface whose fallback does not toggle still asks
		runSurfaceAction(
			{ action: 'default', confirmation: true },
			{ entity: 'lock.front', fallback: vi.fn() }
		);
		expect(get(requestedConfirmation)?.confirmLabel).toBe('Continue');
	});

	it('sends no command from a read-only surface but still navigates', () => {
		const surface = { entity: 'switch.fan', readonly: true, fallback: vi.fn() };
		runSurfaceAction({ action: 'toggle', confirmation: true }, surface);
		runSurfaceAction({ action: 'perform-action', perform_action: 'script.turn_on' }, surface);
		expect(get(requestedConfirmation)).toBeNull();
		expect(toggleEntity).not.toHaveBeenCalled();
		runSurfaceAction({ action: 'navigate', navigation_path: 'kitchen' }, surface);
		expect(get(currentRoom)).toBe('kitchen');
		expect(actionRuns({ action: 'toggle' }, true)).toBe(false);
		expect(actionRuns({ action: 'more-info' }, true)).toBe(true);
	});
});

describe('tapToggles', () => {
	it('holds for no action, default and a toggle of the own entity only', () => {
		expect(tapToggles(undefined, 'switch.fan')).toBe(true);
		expect(tapToggles({ action: 'default' }, 'switch.fan')).toBe(true);
		expect(tapToggles({ action: 'toggle' }, 'switch.fan')).toBe(true);
		expect(tapToggles({ action: 'toggle', entity: 'switch.other' }, 'switch.fan')).toBe(false);
		expect(tapToggles({ action: 'navigate', navigation_path: 'a' }, 'switch.fan')).toBe(false);
	});
});
