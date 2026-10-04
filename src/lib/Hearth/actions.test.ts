import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import { DEFAULT_HEARTH_CONFIG } from './config';
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
import { customAction, resolvePage, runSurfaceAction } from './actions';

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
			confirmLabel: 'Run'
		});
		expect(toggleEntity).not.toHaveBeenCalled();
		request?.action();
		expect(toggleEntity).toHaveBeenCalledWith('switch.fan');
	});

	it('keeps the unlock question for a toggle action on a lock', () => {
		runSurfaceAction({ action: 'toggle' }, { entity: 'lock.front', fallback: vi.fn() });
		expect(get(requestedConfirmation)?.confirmLabel).toBe('Unlock');
		expect(toggleEntity).not.toHaveBeenCalled();
	});
});
