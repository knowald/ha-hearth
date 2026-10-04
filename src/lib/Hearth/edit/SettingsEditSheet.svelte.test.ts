import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../static/translations/en.json';
import type { HassConfig } from 'home-assistant-js-websocket';
import { config as haConfig } from '$lib/core/ha/connection';
import { DEFAULT_HEARTH_CONFIG } from '../config';
import { editor, hearthConfig, screensaverPreview, setupWizardOpen } from '../store';
import { screenOverrides } from '$lib/core/app/screen';
import { fill } from '$lib/core/i18n';
import { screenSheetOpen } from '../screen';
import SettingsEditSheet from './SettingsEditSheet.svelte';

const zoom = vi.hoisted(() => ({ zoomSupported: false }));
vi.mock('../zoom', () => zoom);

describe('SettingsEditSheet', () => {
	afterEach(() => {
		editor.set(null);
		setupWizardOpen.set(false);
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
		screensaverPreview.set(false);
		screenSheetOpen.set(false);
		screenOverrides.set({});
		zoom.zoomSupported = false;
	});

	it('lists the pages to reorder, open and add, whatever the rail shows', async () => {
		const config = structuredClone(DEFAULT_HEARTH_CONFIG);
		config.rail_position = 'none';
		config.rooms.push({ id: 'kitchen', name: 'Kitchen', icon: 'kitchen', cards: [[]] });
		hearthConfig.set(config);
		render(SettingsEditSheet);
		const up = (name: string) =>
			screen.getByRole('button', {
				name: fill(en.hearth_move_named_up, { name })
			}) as HTMLButtonElement;
		expect(up('Home').disabled).toBe(true);
		await fireEvent.click(up('Kitchen'));
		expect(get(hearthConfig).rooms.map((room) => room.id)).toEqual(['kitchen', 'home']);

		await fireEvent.click(screen.getByRole('button', { name: /^Kitchen$/ }));
		expect(get(editor)).toEqual({ kind: 'room', id: 'kitchen' });
		await fireEvent.click(screen.getByRole('button', { name: new RegExp(en.hearth_add_page) }));
		expect(get(editor)).toEqual({ kind: 'room', id: null });
	});

	it('groups the rows into sections that say where each one is kept', () => {
		const { container } = render(SettingsEditSheet);
		const titles = [...container.querySelectorAll('.section-title')].map(
			(node) => node.textContent
		);
		expect(titles).toEqual([
			en.hearth_this_screen,
			en.hearth_appearance,
			en.hearth_layout_and_navigation,
			en.hearth_size_and_spacing,
			en.hearth_wall_display,
			en.hearth_alerts,
			en.hearth_pages,
			en.hearth_server,
			en.hearth_maintenance
		]);
		const scopes = [...container.querySelectorAll('.section-scope')].map(
			(node) => node.textContent
		);
		expect(scopes[0]).toBe(en.hearth_scope_this_browser);
		expect(scopes.filter((scope) => scope === en.hearth_scope_dashboard)).toHaveLength(6);
		expect(scopes).toContain(en.hearth_scope_saved_now);
		expect(screen.getByText(en.hearth_settings_note)).toBeTruthy();
		const groups = [...container.querySelectorAll('.group-title')].map((node) => node.textContent);
		expect(groups).toEqual([en.hearth_screens_900_px_and_narrower, en.hearth_sleep_screen]);
	});

	it.each([
		[en.theme, { kind: 'theme' }],
		[en.hearth_custom_css, { kind: 'customCss' }],
		[en.hearth_server_settings, { kind: 'appSettings' }]
	])('opens %s from its section', async (label, kind) => {
		render(SettingsEditSheet);
		await fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${label}`) }));
		expect(get(editor)).toEqual(kind);
	});

	it('opens This screen over the sheet', async () => {
		render(SettingsEditSheet);
		await fireEvent.click(
			screen.getByRole('button', { name: new RegExp(en.hearth_this_screen_sub) })
		);
		expect(get(screenSheetOpen)).toBe(true);
	});

	it('keeps a sleep delay and brightness from YAML that no preset matches', () => {
		hearthConfig.set({
			...structuredClone(DEFAULT_HEARTH_CONFIG),
			screensaver_minutes: 7,
			screensaver_brightness: 40
		});
		render(SettingsEditSheet);
		const delay = screen.getByLabelText(en.hearth_sleep_turn_on_after) as HTMLSelectElement;
		expect(delay.value).toBe('7');
		expect(delay.selectedOptions[0].textContent).toBe(fill(en.hearth_custom_value, { value: '7' }));
		const brightness = screen.getByLabelText(en.hearth_screensaver_brightness) as HTMLSelectElement;
		expect(brightness.value).toBe('40');
	});

	it('says when this screen overrides a shared row', () => {
		screenOverrides.set({ keep_screen_on: false });
		render(SettingsEditSheet);
		expect(screen.getByText(en.hearth_this_screen_uses_its_own)).toBeTruthy();
	});

	it('marks both scale rows when this screen picked its own scale', () => {
		screenOverrides.set({ scale: 130 });
		render(SettingsEditSheet);
		expect(screen.getAllByText(en.hearth_this_screen_uses_its_own)).toHaveLength(2);
	});

	it('sets an edit lock and only keeps a PIN of 4 to 8 digits', async () => {
		render(SettingsEditSheet);
		await fireEvent.change(screen.getByLabelText(en.hearth_edit_lock), {
			target: { value: 'pin' }
		});
		expect(get(hearthConfig).edit_lock).toBe('pin');
		expect(screen.getByText(en.hearth_edit_pin_invalid)).toBeTruthy();
		const pin = screen.getByLabelText(en.hearth_edit_pin);
		await fireEvent.change(pin, { target: { value: '12' } });
		expect(get(hearthConfig).edit_pin).toBeUndefined();
		await fireEvent.change(pin, { target: { value: '0042' } });
		expect(get(hearthConfig).edit_pin).toBe('0042');
		expect(screen.getByText(en.hearth_edit_pin_sub)).toBeTruthy();

		await fireEvent.change(screen.getByLabelText(en.hearth_edit_lock), {
			target: { value: 'off' }
		});
		expect(get(hearthConfig)).toMatchObject({ edit_lock: undefined, edit_pin: undefined });
	});

	it('lists the alert rules and opens one, or a new one, in the alert editor', async () => {
		hearthConfig.set({
			...structuredClone(DEFAULT_HEARTH_CONFIG),
			alerts: [
				{
					id: 'fridge',
					title: 'Fridge door open',
					severity: 'warning',
					conditions: [{ entity: 'binary_sensor.fridge_door', state: 'on' }]
				}
			]
		});
		render(SettingsEditSheet);
		await fireEvent.click(screen.getByRole('button', { name: /Fridge door open/ }));
		expect(get(editor)).toEqual({ kind: 'alert', index: 0 });
		await fireEvent.click(screen.getByRole('button', { name: new RegExp(en.hearth_add_alert) }));
		expect(get(editor)).toEqual({ kind: 'alert', index: null });
	});

	it('opens the area import, which the edit bar hides on phones', async () => {
		editor.set({ kind: 'settings' });
		render(SettingsEditSheet);
		await fireEvent.click(screen.getByRole('button', { name: new RegExp(en.hearth_setup) }));
		expect(get(setupWizardOpen)).toBe(true);
	});

	it('names its header action Close, since every row applies live', () => {
		render(SettingsEditSheet);
		expect(screen.queryByRole('button', { name: en.done })).toBeNull();
		expect(screen.getAllByRole('button', { name: en.hearth_close })).toHaveLength(2);
	});

	it.each([
		[en.hearth_edit_configuration_yaml, 'code'],
		[en.hearth_versions, 'versions']
	])('opens %s with a way back to settings', async (label, kind) => {
		render(SettingsEditSheet);
		await fireEvent.click(screen.getByRole('button', { name: new RegExp(label) }));
		expect(get(editor)).toEqual({ kind, from: { kind: 'settings' } });
	});

	it('explains the scale rows where the browser can scale', () => {
		zoom.zoomSupported = true;
		render(SettingsEditSheet);
		expect(screen.queryByText(en.hearth_scale_unsupported)).toBeNull();
		expect(screen.getByText(en.hearth_size_of_text_and_controls)).toBeTruthy();
		expect(screen.getByText(en.hearth_for_phone_width_screens)).toBeTruthy();
	});

	it('keeps the mobile rows explained where the browser cannot scale', () => {
		render(SettingsEditSheet);
		expect(screen.getAllByText(en.hearth_scale_unsupported)).toHaveLength(1);
		expect(screen.getByText(en.hearth_for_phone_width_screens)).toBeTruthy();
	});

	it('previews the sleep screen', async () => {
		render(SettingsEditSheet);
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_preview_sleep_screen }));
		expect(get(screensaverPreview)).toBe(true);
	});

	it('starts a custom radar location from the home coordinates', async () => {
		haConfig.set({ latitude: 51.123456, longitude: 17.0 } as HassConfig);
		render(SettingsEditSheet);
		expect(screen.queryByLabelText(en.hearth_sleep_use_home_location)).toBeNull();
		await fireEvent.change(screen.getByLabelText(en.hearth_sleep_background), {
			target: { value: 'radar' }
		});
		await fireEvent.click(screen.getByRole('switch', { name: en.hearth_sleep_use_home_location }));
		expect(get(hearthConfig).screensaver_radar).toEqual({ latitude: 51.1235, longitude: 17 });

		await fireEvent.change(screen.getByLabelText(en.hearth_sleep_latitude), {
			target: { value: '95' }
		});
		expect(get(hearthConfig).screensaver_radar?.latitude).toBe(51.1235);
		expect(screen.getByLabelText(en.hearth_sleep_latitude).getAttribute('aria-invalid')).toBe(
			'true'
		);
		expect(screen.getByText('Enter a number from -90 to 90')).toBeTruthy();
		await fireEvent.change(screen.getByLabelText(en.hearth_sleep_longitude), {
			target: { value: '-3.7' }
		});
		expect(get(hearthConfig).screensaver_radar).toEqual({ latitude: 51.1235, longitude: -3.7 });
	});

	it('asks for coordinates directly when Home Assistant has no home location', async () => {
		haConfig.set({} as HassConfig);
		render(SettingsEditSheet);
		await fireEvent.change(screen.getByLabelText(en.hearth_sleep_background), {
			target: { value: 'radar' }
		});
		expect(screen.queryByRole('switch', { name: en.hearth_sleep_use_home_location })).toBeNull();
		await fireEvent.change(screen.getByLabelText(en.hearth_sleep_latitude), {
			target: { value: '40.4' }
		});
		expect(get(hearthConfig).screensaver_radar).toEqual({ latitude: 40.4 });
	});

	it('takes a custom basemap only as a tile template', async () => {
		render(SettingsEditSheet);
		await fireEvent.change(screen.getByLabelText(en.hearth_sleep_background), {
			target: { value: 'radar' }
		});
		const tiles = screen.getByLabelText(en.hearth_sleep_tile_url);
		await fireEvent.input(tiles, { target: { value: 'https://tiles.example/map.png' } });
		await fireEvent.change(tiles);
		expect(get(hearthConfig).screensaver_radar).toBeUndefined();
		expect(screen.getByText(en.hearth_sleep_tile_url_invalid)).toBeTruthy();

		await fireEvent.input(tiles, { target: { value: 'https://tiles.example/{z}/{x}/{y}.png' } });
		await fireEvent.change(tiles);
		expect(get(hearthConfig).screensaver_radar).toEqual({
			tile_url: 'https://tiles.example/{z}/{x}/{y}.png'
		});
		expect(screen.getByLabelText(en.hearth_sleep_tile_attribution)).toBeTruthy();
	});

	it('shows the clamped value when the typed one clamps to the stored scale', async () => {
		hearthConfig.set({ ...structuredClone(DEFAULT_HEARTH_CONFIG), scale: 200 });
		render(SettingsEditSheet);
		const input = screen.getByRole('spinbutton', { name: en.hearth_interface_scale });
		await fireEvent.change(input, { target: { value: '250' } });
		expect(get(hearthConfig).scale).toBe(200);
		await waitFor(() => expect((input as HTMLInputElement).value).toBe('200'));
	});

	it('follows the tablet scale again when a mobile field is cleared', async () => {
		hearthConfig.set({ ...structuredClone(DEFAULT_HEARTH_CONFIG), scale: 200, mobile_scale: 80 });
		render(SettingsEditSheet);
		const input = screen.getByRole('spinbutton', {
			name: en.hearth_mobile_interface_scale
		}) as HTMLInputElement;
		expect(input.value).toBe('80');
		await fireEvent.change(input, { target: { value: '' } });
		expect(get(hearthConfig).mobile_scale).toBeUndefined();
		await waitFor(() => expect(input.value).toBe('200'));
	});

	it('keeps a mobile padding of zero and drops a desktop one', async () => {
		hearthConfig.set({ ...structuredClone(DEFAULT_HEARTH_CONFIG), padding_x: 24 });
		render(SettingsEditSheet);
		await fireEvent.change(
			screen.getByRole('spinbutton', { name: en.hearth_mobile_side_padding }),
			{
				target: { value: '0' }
			}
		);
		expect(get(hearthConfig).mobile_padding_x).toBe(0);
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_decrease_side_padding }));
		expect(get(hearthConfig).padding_x).toBe(20);
		await fireEvent.change(screen.getByRole('spinbutton', { name: en.hearth_side_padding }), {
			target: { value: '0' }
		});
		expect(get(hearthConfig).padding_x).toBeUndefined();
	});

	it('leaves a mobile row unset when a press clamps to the value it inherits', async () => {
		hearthConfig.set({ ...structuredClone(DEFAULT_HEARTH_CONFIG), scale: 200 });
		const before = get(hearthConfig);
		render(SettingsEditSheet);
		await fireEvent.click(
			screen.getByRole('button', { name: en.hearth_decrease_mobile_side_padding })
		);
		await fireEvent.click(
			screen.getByRole('button', { name: en.hearth_increase_mobile_interface_scale })
		);
		expect(get(hearthConfig)).toBe(before);

		await fireEvent.click(
			screen.getByRole('button', { name: en.hearth_increase_mobile_side_padding })
		);
		expect(get(hearthConfig).mobile_padding_x).toBe(4);
		await fireEvent.click(
			screen.getByRole('button', { name: en.hearth_decrease_mobile_side_padding })
		);
		expect(get(hearthConfig).mobile_padding_x).toBe(0);
	});
});
