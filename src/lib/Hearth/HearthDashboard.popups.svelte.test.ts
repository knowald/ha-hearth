import { act, render, screen, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import { DEFAULT_HEARTH_CONFIG } from './config';
import { closePopup, hearthConfig, hearthNeedsSetup, popup } from './store';
import HearthDashboard from './HearthDashboard.svelte';

const chunk = vi.hoisted(() => ({ offline: true, loads: 0 }));

vi.mock('$lib/core/ha/registry', () => ({ fetchRegistry: vi.fn(() => new Promise(() => {})) }));

vi.mock('./ControlPopup.svelte', async (original) => {
	chunk.loads += 1;
	if (chunk.offline) throw new Error('offline');
	return original();
});

const PUMP = { kind: 'detail', entity: 'switch.pump', name: 'Pump' } as const;

describe('HearthDashboard popups', () => {
	beforeEach(() => {
		vi.stubGlobal('matchMedia', () => ({
			matches: false,
			addEventListener() {},
			removeEventListener() {}
		}));
		vi.stubGlobal(
			'ResizeObserver',
			class {
				observe() {}
				disconnect() {}
			}
		);
		Element.prototype.scrollTo ??= () => {};
		Element.prototype.animate ??= () =>
			({ cancel() {}, finished: Promise.resolve() }) as unknown as Animation;
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		hearthNeedsSetup.set(false);
		hearthConfig.set({
			...DEFAULT_HEARTH_CONFIG,
			rooms: [{ id: 'home', name: 'Home', icon: 'home', cards: [[]] }]
		});
		states.set({ 'switch.pump': hassEntity('switch.pump', 'on', { friendly_name: 'Pump' }) });
	});

	afterEach(() => {
		closePopup();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('drops a popup it could not load and loads the popups again with the next one', async () => {
		render(HearthDashboard);
		await waitFor(() => expect(chunk.loads).toBe(1));

		await act(() => popup.set(PUMP));
		// the first load had failed, so asking loads again; still offline, the popup is dropped
		await waitFor(() => expect(chunk.loads).toBe(2));
		await waitFor(() => expect(get(popup)).toBeNull());
		expect(screen.queryByRole('dialog', { name: 'Pump' })).toBeNull();

		chunk.offline = false;
		await act(() => popup.set(PUMP));
		expect(await screen.findByRole('dialog', { name: 'Pump' })).toBeTruthy();
		expect(get(popup)).toEqual(PUMP);
	});
});
