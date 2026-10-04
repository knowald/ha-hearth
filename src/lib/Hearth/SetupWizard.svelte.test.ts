import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Connection } from 'home-assistant-js-websocket';
import { connection } from '$lib/core/ha/connection';
import { fetchRegistry } from '$lib/core/ha/registry';
import en from '../../../static/translations/en.json';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import { get } from 'svelte/store';
import { DEFAULT_HEARTH_CONFIG } from './config';
import {
	cancelEdit,
	hearthConfig,
	hearthEditMode,
	hearthNeedsSetup,
	hearthRevision,
	saveState,
	setupWizardSource
} from './store';
import SetupWizard from './SetupWizard.svelte';

vi.mock('$lib/core/ha/registry', () => ({ fetchRegistry: vi.fn() }));

function backdrop(container: HTMLElement) {
	return container.querySelector('.overlay') as HTMLElement;
}

async function tap(element: HTMLElement) {
	await fireEvent.pointerDown(element);
	await fireEvent.click(element);
}

describe('SetupWizard', () => {
	beforeEach(() => {
		connection.set({} as Connection);
		vi.mocked(fetchRegistry).mockReturnValue(new Promise(() => {}));
	});
	afterEach(() => connection.set(undefined));

	it('ignores a backdrop tap on first run and offers to skip instead of cancel', async () => {
		const onclose = vi.fn();
		const { container } = render(SetupWizard, { onclose, firstRun: true });
		await tap(backdrop(container));
		expect(onclose).not.toHaveBeenCalled();
		expect(screen.queryByRole('button', { name: en.cancel })).toBeNull();
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_skip_for_now }));
		expect(onclose).toHaveBeenCalledTimes(1);
	});

	it('closes on a backdrop tap when opened on purpose', async () => {
		const onclose = vi.fn();
		const { container } = render(SetupWizard, { onclose });
		await tap(backdrop(container));
		expect(onclose).toHaveBeenCalledTimes(1);
		expect(screen.queryByRole('button', { name: en.hearth_skip_for_now })).toBeNull();
	});

	it('shares the edit sheet chrome: apply in the header beside close, focus inside', async () => {
		const onclose = vi.fn();
		render(SetupWizard, { onclose, firstRun: true });
		const dialog = screen.getByRole('dialog', { name: en.hearth_setup });
		expect(dialog.getAttribute('aria-modal')).toBe('true');
		const apply = screen.getByRole('button', { name: en.hearth_apply }) as HTMLButtonElement;
		const close = screen.getByRole('button', { name: en.hearth_close });
		expect(apply.disabled).toBe(true);
		expect(apply.parentElement).toBe(close.parentElement);
		expect(dialog.contains(document.activeElement)).toBe(true);
		// the close button still works on first run; only the backdrop is ignored
		await fireEvent.click(close);
		expect(onclose).toHaveBeenCalledTimes(1);
	});

	it('announces loading as a status', () => {
		render(SetupWizard, { onclose: vi.fn() });
		expect(screen.getByRole('status').textContent).toContain(en.hearth_loading_registries);
	});

	it('reports a failed registry fetch as a translated alert with the detail beneath', async () => {
		vi.mocked(fetchRegistry).mockRejectedValue(new Error('timeout'));
		render(SetupWizard, { onclose: vi.fn() });
		const alert = await screen.findByRole('alert');
		expect(alert.querySelector('strong')?.textContent).toBe(en.hearth_registries_failed);
		expect(alert.textContent).toContain('timeout');
	});

	describe('an import whose save fails', () => {
		beforeEach(() => {
			hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
			hearthNeedsSetup.set(true);
			states.set({ 'light.kitchen': hassEntity('light.kitchen', 'on') });
			vi.mocked(fetchRegistry).mockResolvedValue({
				floors: [],
				areas: [{ area_id: 'kitchen', name: 'Kitchen' }],
				devices: [],
				entities: [
					{
						entity_id: 'light.kitchen',
						area_id: 'kitchen',
						device_id: null,
						disabled_by: null,
						hidden_by: null
					}
				]
			} as never);
			vi.spyOn(console, 'error').mockImplementation(() => {});
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'disk full' })
			);
		});

		afterEach(() => {
			cancelEdit();
			hearthNeedsSetup.set(false);
			states.set({});
			hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
			vi.unstubAllGlobals();
			vi.restoreAllMocks();
		});

		it('hands the import to edit mode, where Cancel returns to the dashboard from before it', async () => {
			const onclose = vi.fn();
			render(SetupWizard, { onclose });
			const apply = screen.getByRole('button', { name: en.hearth_apply }) as HTMLButtonElement;
			await waitFor(() => expect(apply.disabled).toBe(false));
			await fireEvent.click(apply);
			await waitFor(() => expect(get(hearthEditMode)).toBe(true));
			expect(get(saveState)).toBe('error');
			// the edit bar reports the failure, so the wizard gets out of its way
			await waitFor(() => expect(onclose).toHaveBeenCalled());
			expect(screen.queryByRole('dialog', { name: en.hearth_tablet_title })).toBeNull();
			expect(get(hearthConfig)).not.toEqual(DEFAULT_HEARTH_CONFIG);
			cancelEdit();
			expect(get(hearthConfig)).toEqual(DEFAULT_HEARTH_CONFIG);
			// still a first run, so the dashboard offers the import again
			expect(get(hearthNeedsSetup)).toBe(true);
		});
	});

	describe('an import that saves', () => {
		beforeEach(() => {
			hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
			states.set({
				'light.kitchen': hassEntity('light.kitchen', 'on', { friendly_name: 'Kitchen light' }),
				'switch.kettle': hassEntity('switch.kettle', 'off', { friendly_name: 'Kettle' }),
				'scene.dinner': hassEntity('scene.dinner', 'unknown')
			});
			vi.mocked(fetchRegistry).mockResolvedValue({
				floors: [],
				areas: [{ area_id: 'kitchen', name: 'Kitchen' }],
				devices: [],
				entities: ['light.kitchen', 'switch.kettle', 'scene.dinner'].map((entity_id) => ({
					entity_id,
					area_id: entity_id === 'scene.dinner' ? null : 'kitchen',
					device_id: null,
					disabled_by: null,
					hidden_by: null
				}))
			} as never);
			hearthRevision.set(1);
			// the server holds the revision this page loaded, and each save adds one
			vi.stubGlobal(
				'fetch',
				vi.fn(async (url: string) => ({
					ok: true,
					status: 200,
					json: async () => ({ revision: url.endsWith('/_api/hearth_versions') ? 1 : 2 })
				}))
			);
		});

		afterEach(() => {
			hearthRevision.set(0);
			setupWizardSource.set('areas');
			states.set({});
			hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
			vi.unstubAllGlobals();
		});

		async function apply() {
			const button = screen.getByRole('button', { name: en.hearth_apply }) as HTMLButtonElement;
			await waitFor(() => expect(button.disabled).toBe(false));
			await fireEvent.click(button);
		}

		it('ends on the tablet address with a QR code and the device name in the link', async () => {
			const onclose = vi.fn();
			render(SetupWizard, { onclose });
			await apply();

			const dialog = await screen.findByRole('dialog', { name: en.hearth_tablet_title });
			expect(dialog.textContent).toContain(`${location.origin}/`);
			await fireEvent.input(screen.getByLabelText(en.hearth_device_name), {
				target: { value: 'kitchen' }
			});
			expect(dialog.textContent).toContain(`${location.origin}/?device=kitchen`);
			const qr = await screen.findByRole('img', {
				name: `QR code for ${location.origin}/?device=kitchen`
			});
			expect(qr.querySelector('path')?.getAttribute('d')).toMatch(/^M\d+ \d+h1v1h-1z/);
			// the dashboard already holds the import
			expect(get(hearthConfig).rooms.map((room) => room.name)).toContain('Kitchen');

			await fireEvent.click(screen.getByRole('button', { name: en.done }));
			expect(onclose).toHaveBeenCalledTimes(1);
		});

		it('builds a starter layout from the home entities', async () => {
			setupWizardSource.set('starter');
			render(SetupWizard, { onclose: vi.fn() });
			expect(screen.getByRole('dialog', { name: en.hearth_starter_layouts })).toBeTruthy();
			await fireEvent.click(await screen.findByRole('radio', { name: /Phone remote/ }));
			await apply();

			await screen.findByRole('dialog', { name: en.hearth_tablet_title });
			const rooms = get(hearthConfig).rooms;
			// the untouched Home page made way for the starter
			expect(rooms.map((room) => room.name)).toEqual([en.hearth_starter_phone_page]);
			expect(rooms[0].cards[0].map((card) => ('type' in card ? card.type : 'stack'))).toEqual([
				'scenes',
				'entities'
			]);
		});

		it('adds only the entities an existing page lacks', async () => {
			hearthConfig.update((config) => ({
				...config,
				rooms: [
					{
						id: 'kitchen',
						name: 'Kitchen',
						icon: 'countertops',
						cards: [
							[
								{
									id: 'mine',
									type: 'entities',
									entities: [{ entity: 'light.kitchen', name: 'Mine' }]
								}
							]
						]
					}
				]
			}));
			render(SetupWizard, { onclose: vi.fn() });
			await fireEvent.click(
				await screen.findByRole('radio', { name: en.hearth_import_mode_merge })
			);
			expect(screen.getByText('1 new entity')).toBeTruthy();
			await apply();

			await screen.findByRole('dialog', { name: en.hearth_tablet_title });
			const [kitchen] = get(hearthConfig).rooms;
			expect(kitchen.cards.flat().map((card) => card.id)).toEqual(['mine', 'kitchen-devices']);
			expect(kitchen.cards[0][0]).toMatchObject({
				entities: [{ entity: 'light.kitchen', name: 'Mine' }]
			});
		});
	});
});
