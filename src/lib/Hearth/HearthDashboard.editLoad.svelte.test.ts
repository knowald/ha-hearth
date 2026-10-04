import { act, fireEvent, render, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../static/translations/en.json';
import { states } from '$lib/core/ha/entities';
import { DEFAULT_HEARTH_CONFIG } from './config';
import { loadEditBar, loadEditorHost } from './editLoader';
import {
	cancelEdit,
	dismissConfirmation,
	enterEditMode,
	hearthConfig,
	hearthEditMode,
	requestedConfirmation,
	updateConfig
} from './store';
import HearthDashboard from './HearthDashboard.svelte';

vi.mock('$lib/core/ha/registry', () => ({ fetchRegistry: vi.fn(() => new Promise(() => {})) }));

// the real chunks, unless a test makes one fail
vi.mock('./editLoader', async () => ({
	loadEditBar: vi.fn(() => import('./shell/EditBar.svelte')),
	loadEditorHost: vi.fn(() => import('./edit/EditorHost.svelte')),
	preloadEditMode: vi.fn(async () => true)
}));

const failed = () => Promise.reject(new Error('chunk failed to load'));

async function editWithFallback() {
	render(HearthDashboard);
	await act(() => enterEditMode());
	const message = await screen.findByText(en.hearth_could_not_load_component);
	expect(message.closest('[role="alert"]')).not.toBeNull();
}

describe('HearthDashboard when edit mode cannot load', () => {
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
		states.set({});
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
	});

	afterEach(() => {
		dismissConfirmation();
		if (get(hearthEditMode)) cancelEdit();
		vi.mocked(loadEditBar).mockImplementation(() => import('./shell/EditBar.svelte'));
		vi.mocked(loadEditorHost).mockImplementation(() => import('./edit/EditorHost.svelte'));
		vi.unstubAllGlobals();
	});

	it('offers a way out when the edit bar fails, asking first about unsaved edits', async () => {
		vi.mocked(loadEditBar).mockImplementation(failed);
		await editWithFallback();
		expect(screen.queryByRole('button', { name: en.save })).toBeNull();

		updateConfig((config) => {
			config.rooms[0].name = 'Renamed';
		});
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_exit_edit_mode }));
		expect(get(hearthEditMode)).toBe(true);
		expect(get(requestedConfirmation)).toMatchObject({ confirmLabel: en.hearth_discard });
		await act(() => get(requestedConfirmation)?.action());
		expect(get(hearthEditMode)).toBe(false);
		expect(get(hearthConfig).rooms[0].name).toBe(DEFAULT_HEARTH_CONFIG.rooms[0].name);
	});

	it('hides the bar while the editor host is missing and loads both again on Retry', async () => {
		vi.mocked(loadEditorHost).mockImplementation(failed);
		await editWithFallback();
		expect(screen.queryByRole('button', { name: en.save })).toBeNull();

		vi.mocked(loadEditorHost).mockImplementation(() => import('./edit/EditorHost.svelte'));
		vi.mocked(loadEditBar).mockClear();
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_retry }));
		expect(await screen.findByRole('button', { name: en.save })).toBeTruthy();
		expect(loadEditBar).toHaveBeenCalledOnce();
		expect(screen.queryByText(en.hearth_could_not_load_component)).toBeNull();
	});

	it('leaves at once without edits', async () => {
		vi.mocked(loadEditBar).mockImplementation(failed);
		await editWithFallback();
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_exit_edit_mode }));
		expect(get(hearthEditMode)).toBe(false);
		expect(get(requestedConfirmation)).toBeNull();
	});
});
