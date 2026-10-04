import { fireEvent, render, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { english as en } from '$lib/core/i18n/testing';
import { DEFAULT_HEARTH_CONFIG, type HearthConfig, type OverviewCard } from '../config';
import { editor, hearthConfig, hearthEditMode } from '../store';
import { savedThemes } from '../themeSchedule';
import CardEditSheet from './CardEditSheet.svelte';
import RoomEditSheet from './RoomEditSheet.svelte';
import ThemeEditSheet from './ThemeEditSheet.svelte';

/* The editor side of page looks, card spans and the theme schedule. */

const IMAGE = 'hearth-images/0123456789abcdef0123456789abcdef.webp';

function seed() {
	const config: HearthConfig = structuredClone(DEFAULT_HEARTH_CONFIG);
	config.rooms = [
		{
			id: 'den',
			name: 'Den',
			icon: 'sofa',
			columns: 2,
			cards: [
				[
					{ id: 'lights', type: 'entities', entities: [] },
					{
						id: 'stack',
						kind: 'stack',
						direction: 'vertical',
						cards: [{ id: 'inner', type: 'entities', entities: [] }]
					}
				],
				[]
			] as never
		},
		{ id: 'hall', name: 'Hall', icon: 'door_front', cards: [[{ id: 'mat', type: 'iframe' }]] }
	] as never;
	hearthConfig.set(config);
}

beforeEach(() => {
	vi.stubGlobal(
		'fetch',
		vi.fn().mockResolvedValue({
			ok: true,
			json: async () => [{ id: 'moss', name: 'Moss', theme: { accent: '#3a7d44' } }]
		})
	);
	seed();
});

afterEach(() => {
	vi.unstubAllGlobals();
	editor.set(null);
	savedThemes.set(undefined);
	hearthEditMode.set(false);
	localStorage.clear();
	hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
});

describe('page look', () => {
	it('saves a theme, a background and its scrim with the page', async () => {
		render(RoomEditSheet, { id: 'den' });
		const theme = screen.getByLabelText(en.theme) as HTMLSelectElement;
		expect([...theme.options].map((option) => option.value)).toContain('winter');
		await fireEvent.change(theme, { target: { value: 'autumn' } });

		const image = screen.getByLabelText(en.hearth_background_image);
		await fireEvent.input(image, { target: { value: IMAGE } });
		await fireEvent.change(screen.getByLabelText(en.hearth_background_scrim), {
			target: { value: 'strong' }
		});
		await fireEvent.click(screen.getByRole('button', { name: en.done }));
		expect(get(hearthConfig).rooms[0]).toMatchObject({
			theme: 'autumn',
			background_image: IMAGE,
			background_scrim: 'strong'
		});
	});

	it('offers saved themes by name and stores the medium scrim as unset', async () => {
		render(RoomEditSheet, { id: 'den' });
		await vi.waitFor(() => expect(get(savedThemes)).toBeDefined());
		const theme = screen.getByLabelText(en.theme) as HTMLSelectElement;
		await fireEvent.change(theme, { target: { value: 'Moss' } });
		await fireEvent.input(screen.getByLabelText(en.hearth_background_image), {
			target: { value: IMAGE }
		});
		await fireEvent.click(screen.getByRole('button', { name: en.done }));
		const den = get(hearthConfig).rooms[0];
		expect(den.theme).toBe('Moss');
		expect(den.background_scrim).toBeUndefined();
	});

	it('holds Done while the background could not stay inside its token', async () => {
		render(RoomEditSheet, { id: 'den' });
		await fireEvent.input(screen.getByLabelText(en.hearth_background_image), {
			target: { value: 'a.jpg); color: red' }
		});
		expect(screen.getByRole('button', { name: en.done })).toHaveProperty('disabled', true);
	});
});

describe('card width', () => {
	it('spans a card on a page of two columns', async () => {
		render(CardEditSheet, { roomId: 'den', id: 'lights' });
		const width = (await screen.findByLabelText(en.hearth_card_width)) as HTMLSelectElement;
		expect([...width.options].map((option) => option.value)).toEqual(['', 'full']);
		await fireEvent.change(width, { target: { value: 'full' } });
		await fireEvent.click(screen.getByRole('button', { name: en.done }));
		const lights = get(hearthConfig).rooms[0].cards[0][0] as OverviewCard;
		expect(lights.span).toBe('full');
	});

	it('offers no width on a one-column page or inside a stack', async () => {
		const hall = render(CardEditSheet, { roomId: 'hall', id: 'mat' });
		await screen.findByLabelText(en.hearth_page);
		expect(screen.queryByLabelText(en.hearth_card_width)).toBeNull();
		hall.unmount();

		render(CardEditSheet, { roomId: 'den', id: 'inner' });
		await screen.findByLabelText(en.hearth_page);
		expect(screen.queryByLabelText(en.hearth_card_width)).toBeNull();
	});
});

describe('theme schedule', () => {
	it('adds an entry, edits its days and removes it again', async () => {
		editor.set({ kind: 'theme' });
		render(ThemeEditSheet);
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_add_schedule_entry }));
		expect(get(hearthConfig).theme_schedule).toEqual([
			{ theme: 'winter', from: '12-01', to: '02-29' }
		]);

		const label = en.hearth_schedule_entry.replace('{number}', '1');
		await fireEvent.change(screen.getByLabelText(label), { target: { value: 'holiday' } });
		const from = screen.getByLabelText(en.hearth_schedule_from);
		await fireEvent.input(from, { target: { value: '12-40' } });
		// under the field, and again as the reason Close is held
		expect(screen.getAllByText(en.hearth_schedule_day_format)).toHaveLength(2);
		await fireEvent.input(from, { target: { value: '12-20' } });
		await fireEvent.change(from);
		const to = screen.getByLabelText(en.hearth_schedule_to);
		await fireEvent.input(to, { target: { value: '12-26' } });
		await fireEvent.change(to);
		expect(get(hearthConfig).theme_schedule).toEqual([
			{ theme: 'holiday', from: '12-20', to: '12-26' }
		]);

		await fireEvent.click(
			screen.getByRole('button', {
				name: en.hearth_remove_schedule_entry.replace('{number}', '1')
			})
		);
		expect(get(hearthConfig).theme_schedule).toBeUndefined();
	});

	it('keeps an edit that fired no change event once the sheet goes, unless editing ended', async () => {
		editor.set({ kind: 'theme' });
		hearthEditMode.set(true);
		const first = render(ThemeEditSheet);
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_add_schedule_entry }));
		await fireEvent.input(screen.getByLabelText(en.hearth_schedule_from), {
			target: { value: '11-15' }
		});
		first.unmount();
		expect(get(hearthConfig).theme_schedule?.[0].from).toBe('11-15');

		const second = render(ThemeEditSheet);
		await fireEvent.input(screen.getByLabelText(en.hearth_schedule_from), {
			target: { value: '10-01' }
		});
		hearthEditMode.set(false);
		second.unmount();
		expect(get(hearthConfig).theme_schedule?.[0].from).toBe('11-15');
	});

	it('keeps tokens written out in YAML until another theme is picked', async () => {
		hearthConfig.update((config) => ({
			...config,
			theme_schedule: [{ theme: { accent: '#ff8800' }, night: 'void', from: '10-31', to: '10-31' }]
		}));
		editor.set({ kind: 'theme' });
		render(ThemeEditSheet);
		const label = en.hearth_schedule_entry.replace('{number}', '1');
		const select = screen.getByLabelText(label) as HTMLSelectElement;
		expect(select.selectedOptions[0].textContent).toBe(en.hearth_schedule_tokens);
		const to = screen.getByLabelText(en.hearth_schedule_to);
		await fireEvent.input(to, { target: { value: '11-01' } });
		await fireEvent.change(to);
		expect(get(hearthConfig).theme_schedule).toEqual([
			{ theme: { accent: '#ff8800' }, night: 'void', from: '10-31', to: '11-01' }
		]);
	});
});
