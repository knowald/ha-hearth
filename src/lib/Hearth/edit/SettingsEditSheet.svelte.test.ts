import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, describe, expect, it } from 'vitest';
import en from '../../../../static/translations/en.json';
import type { HassConfig } from 'home-assistant-js-websocket';
import { config as haConfig } from '$lib/core/ha/connection';
import { DEFAULT_HEARTH_CONFIG } from '../config';
import { editor, hearthConfig, screensaverPreview, setupWizardOpen } from '../store';
import SettingsEditSheet from './SettingsEditSheet.svelte';

describe('SettingsEditSheet', () => {
	afterEach(() => {
		editor.set(null);
		setupWizardOpen.set(false);
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
		screensaverPreview.set(false);
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
});
