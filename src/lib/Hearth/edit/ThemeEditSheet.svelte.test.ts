import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { DEFAULT_HEARTH_CONFIG } from '../config';
import { GLASS_THEME, THEME_DEFAULTS } from '$lib/core/theme';
import { english as en } from '$lib/core/i18n/testing';
import {
	confirmRequestedAction,
	dismissConfirmation,
	editor,
	hearthConfig,
	hearthEditMode,
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
	const saved: { id: string; name: string; theme: Record<string, string> } = {
		id: 'dusk',
		name: 'Dusk',
		theme: {}
	};
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

	it('leaves out a saved theme value the dashboard cannot apply', async () => {
		saved.theme = { accent: '#f80', text_1: '#fff /*', text_2: '#ddd' };
		render(ThemeEditSheet);
		await fireEvent.click(await screen.findByRole('button', { name: 'Dusk' }));
		expect(get(hearthConfig).theme).toEqual({ accent: '#ff8800', text_2: '#ddd' });
		saved.theme = {};
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

describe('ThemeEditSheet fonts and background shade', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
		editor.set({ kind: 'theme' });
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		editor.set(null);
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
	});

	it('labels the night slot with its own copy', () => {
		render(ThemeEditSheet);
		expect(screen.getByRole('button', { name: new RegExp(en.hearth_theme_night) })).toBeTruthy();
	});

	it('offers the shade only over a background image', async () => {
		render(ThemeEditSheet);
		expect(screen.queryByLabelText(en.hearth_background_scrim)).toBeNull();
		hearthConfig.set({
			...structuredClone(DEFAULT_HEARTH_CONFIG),
			theme: { background_image: 'url(/room.jpg)' }
		});
		const shade = (await screen.findByLabelText(en.hearth_background_scrim)) as HTMLSelectElement;
		expect(shade.value).toBe('none');
		await fireEvent.change(shade, { target: { value: GLASS_THEME.background_scrim } });
		expect(get(hearthConfig).theme?.background_scrim).toBe(GLASS_THEME.background_scrim);
		await fireEvent.change(shade, { target: { value: 'none' } });
		expect(get(hearthConfig).theme).toEqual({ background_image: 'url(/room.jpg)' });
	});

	it('holds back a background address that would leave its token', async () => {
		render(ThemeEditSheet);
		const field = screen.getByLabelText(en.hearth_background_image);
		await fireEvent.input(field, { target: { value: 'a.jpg); color: red' } });
		await fireEvent.change(field);
		expect(screen.getByText(/must be one CSS value/)).toBeTruthy();
		expect(get(hearthConfig).theme).toBeUndefined();
		await fireEvent.input(field, { target: { value: '/room.jpg' } });
		await fireEvent.change(field);
		expect(screen.queryByText(/must be one CSS value/)).toBeNull();
		expect(get(hearthConfig).theme).toEqual({ background_image: 'url(/room.jpg)' });
	});

	it('sets the fonts and shows a stack from YAML by its first family', async () => {
		hearthConfig.set({
			...structuredClone(DEFAULT_HEARTH_CONFIG),
			theme: { font_ui: "'Inter Variable', system-ui" }
		});
		render(ThemeEditSheet);
		const text = screen.getByLabelText(en.hearth_font) as HTMLSelectElement;
		expect(text.selectedOptions[0].textContent).toBe('Custom (Inter Variable)');
		await fireEvent.change(screen.getByLabelText(en.hearth_label_font), {
			target: { value: 'var(--h-font-ui)' }
		});
		expect(get(hearthConfig).theme?.font_mono).toBe('var(--h-font-ui)');
		// the default is no override at all, not a copy of the default stack
		await fireEvent.change(text, { target: { value: THEME_DEFAULTS.font_ui } });
		expect(get(hearthConfig).theme).toEqual({ font_mono: 'var(--h-font-ui)' });
	});
});

describe('ThemeEditSheet schedule days', () => {
	const party = [{ entity: 'input_boolean.party' }];

	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
		hearthConfig.set({
			...structuredClone(DEFAULT_HEARTH_CONFIG),
			theme_schedule: [
				{ theme: 'winter', from: '12-01', to: '02-29' },
				{ theme: 'holiday', from: '12-20', to: '12-26', when: party }
			]
		});
		editor.set({ kind: 'theme' });
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		editor.set(null);
		hearthEditMode.set(false);
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
	});

	// the header's primary action; the close button shares its name
	const closeAction = () =>
		screen
			.getAllByRole('button', { name: en.hearth_close })
			.find((button): button is HTMLButtonElement => button.classList.contains('primary'));

	const saved = () => [
		{ theme: 'winter', from: '12-01', to: '02-29' },
		{ theme: 'holiday', from: '12-20', to: '12-26', when: party }
	];

	it('keeps the last entry for a mistyped day and holds Close until it is fixed', async () => {
		render(ThemeEditSheet);
		const close = closeAction();
		const from = screen.getAllByLabelText(en.hearth_schedule_from)[0];
		await fireEvent.input(from, { target: { value: '13-45' } });
		await fireEvent.change(from);
		expect(get(hearthConfig).theme_schedule).toEqual(saved());
		expect(close?.disabled).toBe(true);
		expect(screen.getAllByText(en.hearth_schedule_day_format).length).toBeGreaterThan(0);

		await fireEvent.input(from, { target: { value: '11-15' } });
		await fireEvent.change(from);
		expect(close?.disabled).toBe(false);
		expect(get(hearthConfig).theme_schedule?.[0]).toEqual({
			theme: 'winter',
			from: '11-15',
			to: '02-29'
		});
	});

	it('keeps both days of an entry with conditions when one is cleared', async () => {
		render(ThemeEditSheet);
		const to = screen.getAllByLabelText(en.hearth_schedule_to)[1];
		await fireEvent.input(to, { target: { value: '' } });
		await fireEvent.change(to);
		expect(get(hearthConfig).theme_schedule).toEqual(saved());
		expect(closeAction()?.disabled).toBe(true);
	});

	it('writes no mistyped day when the sheet goes away', async () => {
		hearthEditMode.set(true);
		const { unmount } = render(ThemeEditSheet);
		const from = screen.getAllByLabelText(en.hearth_schedule_from)[1];
		await fireEvent.input(from, { target: { value: '12-2x' } });
		unmount();
		expect(get(hearthConfig).theme_schedule).toEqual(saved());
	});
});
