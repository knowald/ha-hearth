import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../static/translations/en.json';
import { DEFAULT_HEARTH_CONFIG } from '../config';
import { currentRoom, hearthConfig } from '../store';
import type { StatusWidget } from '../widgets/status/descriptor';
import StatusEditor from '../widgets/status/Editor.svelte';
import StatusWidgetView from '../widgets/status/Widget.svelte';

// the status widget editor is the smallest host for two action fields
function renderEditor(initial?: Partial<StatusWidget>) {
	const onchange = vi.fn();
	render(StatusEditor, {
		initial: initial ? ({ id: 's', type: 'status', ...initial } as StatusWidget) : undefined,
		onchange
	});
	return () => onchange.mock.lastCall?.[0] as { fields: StatusWidget; valid?: boolean };
}

function select(label: string) {
	return screen.getAllByLabelText(label)[0] as HTMLSelectElement;
}

beforeEach(() => {
	hearthConfig.set({
		...structuredClone(DEFAULT_HEARTH_CONFIG),
		rooms: [
			{ id: 'home', name: 'Home', icon: 'home', cards: [[]] },
			{ id: 'kitchen', name: 'Kitchen', icon: 'home', cards: [[]] }
		]
	});
	currentRoom.set('home');
});

afterEach(() => vi.clearAllMocks());

describe('ActionField', () => {
	it('stores nothing while both actions stay on default', () => {
		const last = renderEditor();
		expect(last().fields.tap_action).toBeUndefined();
		expect(last().fields.hold_action).toBeUndefined();
		expect(last().valid).toBe(true);
	});

	it('builds a perform-action and blocks Done until the service reads domain.service', async () => {
		const last = renderEditor();
		await fireEvent.change(select(en.hearth_tap_action), {
			target: { value: 'perform-action' }
		});
		expect(last().valid).toBe(false);
		expect(screen.getByText(en.hearth_action_service_invalid)).toBeTruthy();

		await fireEvent.input(screen.getByLabelText(en.hearth_action_service), {
			target: { value: ' script.turn_on ' }
		});
		await fireEvent.input(screen.getByLabelText(en.hearth_action_target), {
			target: { value: 'script.goodnight' }
		});
		expect(last().valid).toBe(true);
		expect(last().fields.tap_action).toMatchObject({
			action: 'perform-action',
			perform_action: 'script.turn_on',
			target: { entity_id: 'script.goodnight' }
		});
	});

	it('picks a page for navigate and keeps an unknown Lovelace path visible', async () => {
		const last = renderEditor({
			hold_action: { action: 'navigate', navigation_path: '/lovelace/garage' }
		});
		const page = select(en.hearth_page);
		expect(within(page).getByText('/lovelace/garage (no such page)')).toBeTruthy();
		await fireEvent.change(page, { target: { value: 'kitchen' } });
		expect(last().fields.hold_action).toMatchObject({
			action: 'navigate',
			navigation_path: 'kitchen'
		});
	});

	it('rejects a URL that is not http(s) or a local path', async () => {
		const last = renderEditor();
		await fireEvent.change(select(en.hearth_tap_action), { target: { value: 'url' } });
		const url = screen.getByLabelText(en.hearth_url);
		await fireEvent.input(url, { target: { value: 'javascript:alert(1)' } });
		expect(last().valid).toBe(false);
		await fireEvent.input(url, { target: { value: 'https://example.com' } });
		expect(last().valid).toBe(true);
		expect(last().fields.tap_action).toMatchObject({ url_path: 'https://example.com' });
	});

	it('stores a confirmation question with the action', async () => {
		const last = renderEditor({ tap_action: { action: 'toggle' } });
		await fireEvent.click(screen.getAllByRole('switch', { name: en.hearth_action_confirm })[0]);
		await fireEvent.input(screen.getByLabelText(en.hearth_action_confirm_text), {
			target: { value: 'Sure?' }
		});
		expect(last().fields.tap_action).toEqual({
			action: 'toggle',
			confirmation: { text: 'Sure?' }
		});
	});
});

describe('status widget actions', () => {
	it('turns a text-only pill into a button that runs its tap action', async () => {
		render(StatusWidgetView, {
			widget: {
				id: 's',
				type: 'status',
				text: 'Kitchen',
				tap_action: { action: 'navigate', navigation_path: 'Kitchen' }
			}
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Kitchen' }));
		expect(get(currentRoom)).toBe('kitchen');
	});
});
