import { act, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../static/translations/en.json';
import { DEFAULT_HEARTH_CONFIG, type HearthConfig } from '../config';
import {
	cancelEdit,
	cancelRequestedAction,
	dismissConfirmation,
	enterEditMode,
	hearthConfig,
	hearthEditMode,
	hearthLoadError,
	hearthRevision,
	requestedConfirmation,
	saveState,
	updateConfig
} from '../store';
import { HOLD_MS, screenSheetOpen } from '../screen';
import { preloadEditMode } from '../editLoader';
import EditToggle from './EditToggle.svelte';

// edit mode's chunks are a build concern; the toggle only has to wait for them
vi.mock('../editLoader', () => ({ preloadEditMode: vi.fn(async () => true) }));

function withLock(lock: Partial<HearthConfig>) {
	hearthConfig.set({ ...structuredClone(DEFAULT_HEARTH_CONFIG), ...lock });
}

const toggle = () => screen.getByRole('button', { name: en.hearth_edit_configuration });

// the server's revision, which startEditing checks before edit mode opens
let serverRevision = 0;

describe('EditToggle', () => {
	beforeEach(() => {
		serverRevision = 0;
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: true,
				json: async () => ({ revision: serverRevision, versions: [] })
			}))
		);
	});

	afterEach(() => {
		dismissConfirmation();
		hearthRevision.set(0);
		vi.unstubAllGlobals();
		cancelEdit();
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
		hearthLoadError.set(null);
		screenSheetOpen.set(false);
		vi.useRealTimers();
	});

	it('enters edit mode on a tap without a lock', async () => {
		withLock({});
		render(EditToggle);
		await fireEvent.click(toggle());
		await waitFor(() => expect(get(hearthEditMode)).toBe(true));
	});

	it('offers a newer saved revision before editing an old one', async () => {
		withLock({ edit_lock: 'hold' });
		serverRevision = 5;
		vi.useFakeTimers();
		render(EditToggle);
		await fireEvent.pointerDown(toggle(), { button: 0 });
		await act(() => vi.advanceTimersByTime(HOLD_MS));
		vi.useRealTimers();
		await waitFor(() => expect(get(requestedConfirmation)).not.toBeNull());
		expect(get(hearthEditMode)).toBe(false);
	});

	it('opens This screen, also while the dashboard cannot be edited', async () => {
		hearthLoadError.set('broken');
		render(EditToggle);
		expect(screen.queryByRole('button', { name: en.hearth_edit_configuration })).toBeNull();
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_this_screen }));
		expect(get(screenSheetOpen)).toBe(true);
	});

	it('wants a 2-second hold under the hold lock and says so after a tap', async () => {
		vi.useFakeTimers();
		withLock({ edit_lock: 'hold' });
		render(EditToggle);
		await fireEvent.pointerDown(toggle(), { button: 0 });
		await fireEvent.pointerUp(toggle());
		await fireEvent.click(toggle());
		expect(get(hearthEditMode)).toBe(false);
		expect(toggle().textContent).toContain(en.hearth_hold_to_edit);

		await fireEvent.pointerDown(toggle(), { button: 0 });
		await act(() => vi.advanceTimersByTime(HOLD_MS - 100));
		expect(get(hearthEditMode)).toBe(false);
		await act(() => vi.advanceTimersByTime(100));
		vi.useRealTimers();
		await waitFor(() => expect(get(hearthEditMode)).toBe(true));
	});

	it('takes a keyboard hold too', async () => {
		vi.useFakeTimers();
		withLock({ edit_lock: 'hold' });
		render(EditToggle);
		await fireEvent.keyDown(toggle(), { key: 'Enter' });
		await act(() => vi.advanceTimersByTime(HOLD_MS));
		vi.useRealTimers();
		await waitFor(() => expect(get(hearthEditMode)).toBe(true));
	});

	it('asks for the PIN under the PIN lock', async () => {
		withLock({ edit_lock: 'pin', edit_pin: '2468' });
		render(EditToggle);
		await fireEvent.click(toggle());
		const input = await screen.findByLabelText(en.hearth_edit_pin);
		await fireEvent.input(input, { target: { value: '1111' } });
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_unlock }));
		expect(screen.getByRole('alert').textContent).toBe(en.hearth_wrong_pin);
		expect(get(hearthEditMode)).toBe(false);

		await fireEvent.input(input, { target: { value: '2468' } });
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_unlock }));
		await waitFor(() => expect(get(hearthEditMode)).toBe(true));
	});
});

describe('EditToggle starting a session', () => {
	beforeEach(() => {
		cancelEdit();
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
		hearthRevision.set(3);
	});

	afterEach(() => {
		dismissConfirmation();
		cancelEdit();
		saveState.set('idle');
		hearthRevision.set(0);
		vi.unstubAllGlobals();
		vi.mocked(preloadEditMode).mockImplementation(async () => true);
	});

	function serverAt(revision: number | null) {
		vi.stubGlobal(
			'fetch',
			revision === null
				? vi.fn().mockRejectedValue(new Error('offline'))
				: vi.fn().mockResolvedValue({ ok: true, json: async () => ({ revision }) })
		);
	}

	async function startEditing() {
		render(EditToggle);
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_edit_configuration }));
	}

	it('edits at once when the page holds the latest revision', async () => {
		serverAt(3);
		await startEditing();
		await waitFor(() => expect(get(hearthEditMode)).toBe(true));
		expect(get(requestedConfirmation)).toBeNull();
	});

	it('warms edit mode on approach and waits for it before editing', async () => {
		serverAt(3);
		let loaded: (value: boolean) => void = () => {};
		vi.mocked(preloadEditMode).mockClear();
		vi.mocked(preloadEditMode).mockImplementation(() => new Promise((done) => (loaded = done)));
		render(EditToggle);
		await fireEvent.pointerEnter(toggle());
		expect(preloadEditMode).toHaveBeenCalled();
		await fireEvent.click(toggle());
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(get(hearthEditMode)).toBe(false);
		loaded(true);
		await waitFor(() => expect(get(hearthEditMode)).toBe(true));
	});

	it('stays out of edit mode and says so when its code cannot load', async () => {
		serverAt(3);
		vi.mocked(preloadEditMode).mockImplementation(async () => false);
		render(EditToggle);
		await fireEvent.click(toggle());
		expect(await screen.findByRole('alert')).toHaveProperty(
			'textContent',
			en.hearth_could_not_load_component
		);
		expect(get(hearthEditMode)).toBe(false);
		expect(toggle().getAttribute('aria-busy')).toBe('false');
	});

	it('edits at once when the server cannot say', async () => {
		serverAt(null);
		await startEditing();
		await waitFor(() => expect(get(hearthEditMode)).toBe(true));
	});

	it('offers to reload first when another screen saved since the page loaded', async () => {
		serverAt(4);
		await startEditing();
		await waitFor(() =>
			expect(get(requestedConfirmation)).toMatchObject({
				title: en.hearth_newer_config_title,
				confirmLabel: en.hearth_reload,
				cancelLabel: en.hearth_edit_anyway
			})
		);
		expect(get(hearthEditMode)).toBe(false);
		// declining the reload edits the loaded revision anyway
		cancelRequestedAction();
		expect(get(hearthEditMode)).toBe(true);
	});

	it('stays out of edit mode when the offer is only dismissed', async () => {
		serverAt(4);
		await startEditing();
		await waitFor(() => expect(get(requestedConfirmation)).not.toBeNull());
		// what Escape, back and a backdrop tap call
		dismissConfirmation();
		expect(get(hearthEditMode)).toBe(false);
	});

	it('shows the check as busy and ignores taps until it answers', async () => {
		let answer: (value: unknown) => void = () => {};
		const fetchMock = vi.fn(() => new Promise((resolve) => (answer = resolve)));
		vi.stubGlobal('fetch', fetchMock);
		await startEditing();
		const toggle = screen.getByRole('button', { name: en.hearth_edit_configuration });
		expect(toggle.getAttribute('aria-busy')).toBe('true');
		await fireEvent.click(toggle);
		expect(fetchMock).toHaveBeenCalledOnce();
		answer({ ok: true, json: async () => ({ revision: 3 }) });
		await waitFor(() => expect(get(hearthEditMode)).toBe(true));
	});

	it('leaves a session that started during the check alone', async () => {
		let answer: (value: unknown) => void = () => {};
		vi.stubGlobal(
			'fetch',
			vi.fn(() => new Promise((resolve) => (answer = resolve)))
		);
		await startEditing();
		// the import wizard handing a failed save over in the meantime
		updateConfig((config) => {
			config.rooms[0].name = 'Imported';
		});
		saveState.set('error');
		enterEditMode({ config: structuredClone(DEFAULT_HEARTH_CONFIG), needsSetup: false });
		answer({ ok: true, json: async () => ({ revision: 3 }) });
		// let the check finish; a second enterEditMode would clear the failure
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(get(saveState)).toBe('error');
		cancelEdit();
		expect(get(hearthConfig).rooms[0].name).toBe(DEFAULT_HEARTH_CONFIG.rooms[0].name);
	});
});
