import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import en from '../../../../static/translations/en.json';
import { DEFAULT_HEARTH_CONFIG, type HearthConfig } from '../config';
import { editor, hearthConfig } from '../store';
import CardEditSheet from './CardEditSheet.svelte';
import RailWidgetEditSheet from './RailWidgetEditSheet.svelte';
import RoomEditSheet from './RoomEditSheet.svelte';

function seed() {
	const config: HearthConfig = structuredClone(DEFAULT_HEARTH_CONFIG);
	config.rooms = [
		{
			id: 'den',
			name: 'Den',
			icon: 'sofa',
			cards: [
				[
					{ id: 'first', type: 'entities', entities: [] },
					{ id: 'second', type: 'entities', entities: [] }
				] as never
			]
		}
	];
	config.rail = [
		{ id: 'clock', type: 'clock' },
		{ id: 'status', type: 'status' }
	] as never;
	hearthConfig.set(config);
}

const cardIds = () => get(hearthConfig).rooms[0].cards[0].map((item) => item.id);
const widgetIds = () => get(hearthConfig).rail.map((widget) => widget.id);

describe.each([
	['card', () => render(CardEditSheet, { roomId: 'den', id: 'second' })],
	['widget', () => render(RailWidgetEditSheet, { index: 1 })]
])('the %s sheet', (_kind, open) => {
	beforeEach(seed);
	afterEach(() => {
		editor.set(null);
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
	});

	it('gates visibility conditions behind the shared chips', async () => {
		open();
		const always = screen.getByRole('button', { name: en.hearth_always_visible });
		expect(always.getAttribute('aria-pressed')).toBe('true');
		expect(screen.queryByText(en.hearth_entity_state)).toBeNull();
		await fireEvent.click(screen.getByRole('button', { name: en.conditions }));
		expect(screen.getByRole('button', { name: en.conditions }).getAttribute('aria-expanded')).toBe(
			'true'
		);
	});

	it('shows its preview in the shared pane', () => {
		const { container } = open();
		const panes = container.ownerDocument.querySelectorAll('aside.pane');
		expect(panes).toHaveLength(1);
		expect(within(panes[0] as HTMLElement).getByText(en.hearth_live_preview)).toBeTruthy();
		expect(panes[0].querySelector(':scope > .preview')).toBeTruthy();
	});

	it('offers move up and down in the header', () => {
		open();
		expect(screen.getByTitle(en.hearth_move_up)).toBeTruthy();
		expect(screen.getByTitle(en.hearth_move_down)).toBeTruthy();
	});
});

describe('reordering from the sheet header', () => {
	beforeEach(seed);
	afterEach(() => {
		editor.set(null);
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
	});

	it('moves a card within its column and keeps editing it', async () => {
		render(CardEditSheet, { roomId: 'den', id: 'second' });
		await fireEvent.click(screen.getByTitle(en.hearth_move_up));
		expect(cardIds()).toEqual(['second', 'first']);
		await fireEvent.click(screen.getByTitle(en.hearth_move_down));
		expect(cardIds()).toEqual(['first', 'second']);
	});

	it('moves a widget and saves it where it went', async () => {
		render(RailWidgetEditSheet, { index: 1 });
		await fireEvent.click(screen.getByTitle(en.hearth_move_up));
		expect(widgetIds()).toEqual(['status', 'clock']);
		await fireEvent.click(screen.getByRole('button', { name: en.done }));
		expect(widgetIds()).toEqual(['status', 'clock']);
		expect(get(hearthConfig).rail[1]).toMatchObject({ id: 'clock', type: 'clock' });
	});

	it('has no move buttons for a new card or widget', () => {
		render(RailWidgetEditSheet, { index: null });
		expect(screen.queryByTitle(en.hearth_move_up)).toBeNull();
	});
});

describe('RoomEditSheet', () => {
	beforeEach(seed);
	afterEach(() => editor.set(null));

	it('labels page columns through translations', () => {
		render(RoomEditSheet, { id: 'den' });
		const select = screen.getByRole('combobox', {
			name: en.hearth_page_columns
		}) as HTMLSelectElement;
		expect([...select.options].map((option) => option.textContent)).toEqual([
			en.auto,
			en.hearth_one_column,
			'2 columns',
			'3 columns'
		]);
	});

	it('attaches the fill-screen hint to its field', async () => {
		render(RoomEditSheet, { id: 'den' });
		const height = screen.getByRole('combobox', { name: en.hearth_screen_height });
		await fireEvent.change(height, { target: { value: 'fill' } });
		const hint = screen.getByText(en.hearth_media_and_sensor_cards_without_a);
		expect(height.getAttribute('aria-describedby')).toBe(hint.id);
	});
});
