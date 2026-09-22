import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { DEFAULT_HEARTH_CONFIG } from '../config';
import { editor, hearthConfig } from '../store';
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
