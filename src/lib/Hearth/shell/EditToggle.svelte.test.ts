import { act, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../static/translations/en.json';
import { DEFAULT_HEARTH_CONFIG, type HearthConfig } from '../config';
import {
	cancelEdit,
	dismissConfirmation,
	hearthConfig,
	hearthEditMode,
	hearthLoadError,
	hearthRevision,
	requestedConfirmation
} from '../store';
import { HOLD_MS, screenSheetOpen } from '../screen';
import EditToggle from './EditToggle.svelte';

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
