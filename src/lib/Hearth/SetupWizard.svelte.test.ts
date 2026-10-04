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
import { cancelEdit, hearthConfig, hearthEditMode, hearthNeedsSetup, saveState } from './store';
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
			render(SetupWizard, { onclose: vi.fn() });
			const apply = screen.getByRole('button', { name: en.hearth_apply }) as HTMLButtonElement;
			await waitFor(() => expect(apply.disabled).toBe(false));
			await fireEvent.click(apply);
			await waitFor(() => expect(get(hearthEditMode)).toBe(true));
			expect(get(saveState)).toBe('error');
			expect(get(hearthConfig)).not.toEqual(DEFAULT_HEARTH_CONFIG);
			cancelEdit();
			expect(get(hearthConfig)).toEqual(DEFAULT_HEARTH_CONFIG);
			// still a first run, so the dashboard offers the import again
			expect(get(hearthNeedsSetup)).toBe(true);
		});
	});
});
