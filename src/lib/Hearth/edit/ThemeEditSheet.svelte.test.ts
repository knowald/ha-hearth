import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { DEFAULT_HEARTH_CONFIG } from '../config';
import en from '../../../../static/translations/en.json';
import {
	confirmRequestedAction,
	dismissConfirmation,
	editor,
	hearthConfig,
	requestedConfirmation
} from '../store';
import ThemeEditSheet from './ThemeEditSheet.svelte';

describe('ThemeEditSheet day/night switch', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
		editor.set({ kind: 'theme' });
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		editor.set(null);
		states.set({} as never);
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
	});

	it('applies a typed entity and night states as soon as each field changes', async () => {
		render(ThemeEditSheet);
		const entity = screen.getByLabelText(/^Switch entity/);
		await fireEvent.input(entity, { target: { value: 'input_boolean.night' } });
		await fireEvent.change(entity);
		expect(get(hearthConfig).day_night).toEqual({ entity: 'input_boolean.night' });

		const nightStates = screen.getByLabelText('Night states');
		await fireEvent.input(nightStates, { target: { value: 'on' } });
		await fireEvent.change(nightStates);
		expect(get(hearthConfig).day_night).toEqual({
			entity: 'input_boolean.night',
			night_state: 'on'
		});
		expect(get(editor)).toEqual({ kind: 'theme' });
	});

	it('applies an entity chosen in the picker', async () => {
		states.set({
			'sun.sun': {
				entity_id: 'sun.sun',
				state: 'above_horizon',
				attributes: { friendly_name: 'Sun' }
			}
		} as never);
		const { container } = render(ThemeEditSheet);
		await fireEvent.click(container.querySelector('.switch-fields .search')!);
		await fireEvent.click(
			within(screen.getByRole('dialog', { name: 'Choose an entity' })).getByText('Sun')
		);
		expect(get(hearthConfig).day_night).toEqual({ entity: 'sun.sun' });
	});

	it('keeps a value still being typed when the window closes', async () => {
		render(ThemeEditSheet);
		await fireEvent.input(screen.getByLabelText('Night states'), { target: { value: 'on' } });
		await fireEvent.input(screen.getByLabelText(/^Switch entity/), {
			target: { value: 'input_boolean.night' }
		});
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
		expect(get(editor)).toBeNull();
		expect(get(hearthConfig).day_night).toEqual({
			entity: 'input_boolean.night',
			night_state: 'on'
		});
	});
});

describe('ThemeEditSheet saved themes', () => {
	const saved = { id: 'dusk', name: 'Dusk', theme: {} };
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn(async (_address: string, init?: RequestInit) =>
			init?.method === 'DELETE'
				? { ok: false, status: 500, json: async () => null }
				: { ok: true, json: async () => [saved] }
		);
		vi.stubGlobal('fetch', fetchMock);
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
		editor.set({ kind: 'theme' });
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		dismissConfirmation();
		editor.set(null);
	});

	it('names its header action Close, since every field applies live', () => {
		render(ThemeEditSheet);
		expect(screen.queryByRole('button', { name: en.done })).toBeNull();
		expect(screen.getAllByRole('button', { name: en.hearth_close })).toHaveLength(2);
	});

	it('asks through the shared dialog before deleting, and announces a failure', async () => {
		const confirmSpy = vi.fn(() => true);
		vi.stubGlobal('confirm', confirmSpy);
		render(ThemeEditSheet);
		await fireEvent.click(await screen.findByRole('button', { name: `${en.delete} Dusk` }));
		expect(confirmSpy).not.toHaveBeenCalled();
		expect(fetchMock).not.toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ method: 'DELETE' })
		);
		expect(get(requestedConfirmation)?.title).toBe('Delete theme Dusk?');
		confirmRequestedAction();
		await waitFor(() =>
			expect(screen.getByRole('alert').textContent).toContain(en.hearth_theme_delete_failed)
		);
	});
});
