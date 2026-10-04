import { fireEvent, render, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../static/translations/en.json';
import { configuration } from '$lib/core/app/configuration';
import { deviceName, saveDeviceName } from '$lib/core/app/device';
import { screenOverrides } from '$lib/core/app/screen';
import { fill } from '$lib/core/i18n';
import { DEFAULT_HEARTH_CONFIG } from '../config';
import {
	cancelEdit,
	dismissConfirmation,
	enterEditMode,
	hearthConfig,
	requestedConfirmation,
	updateConfig
} from '../store';
import { screenSettings, screenSheetOpen } from '../screen';
import ScreenEditSheet from './ScreenEditSheet.svelte';

const select = (name: string) => screen.getByRole('combobox', { name }) as HTMLSelectElement;

describe('ScreenEditSheet', () => {
	beforeEach(() => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({ ok: true, json: async () => ['en', 'de'] }))
		);
		hearthConfig.set({ ...structuredClone(DEFAULT_HEARTH_CONFIG), screensaver_minutes: 5 });
		configuration.set({ locale: 'en' } as never);
		screenSheetOpen.set(true);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		screenOverrides.set({});
		localStorage.removeItem('hearthScreen');
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
		configuration.set(undefined as never);
		dismissConfirmation();
		saveDeviceName('');
		screenSheetOpen.set(false);
	});

	it('says where its settings live and starts every row at the shared value', () => {
		render(ScreenEditSheet);
		expect(screen.getByText(en.hearth_stored_in_this_browser_only)).toBeTruthy();
		const sleep = select(en.hearth_screensaver);
		expect(sleep.value).toBe('');
		expect(sleep.selectedOptions[0].textContent).toBe(
			fill(en.hearth_same_as_dashboard, { value: en.hearth_after_5_minutes })
		);
		expect(select(en.hearth_keep_screen_awake).selectedOptions[0].textContent).toBe(
			fill(en.hearth_same_as_dashboard, { value: en.on })
		);
	});

	it('turns the sleep screen off here and back to the shared value', async () => {
		render(ScreenEditSheet);
		await fireEvent.change(select(en.hearth_screensaver), { target: { value: '0' } });
		expect(get(screenSettings).sleepMinutes).toBe(0);
		expect(JSON.parse(localStorage.getItem('hearthScreen')!)).toEqual({ screensaver_minutes: 0 });

		await fireEvent.change(select(en.hearth_screensaver), { target: { value: '' } });
		expect(get(screenSettings).sleepMinutes).toBe(5);
		expect(localStorage.getItem('hearthScreen')).toBeNull();
	});

	it('keeps the wake lock and scale for this screen alone', async () => {
		render(ScreenEditSheet);
		await fireEvent.change(select(en.hearth_keep_screen_awake), { target: { value: 'off' } });
		await fireEvent.change(select(en.hearth_interface_scale), { target: { value: '130' } });
		expect(get(screenSettings)).toMatchObject({
			keepScreenOn: false,
			scale: 130,
			mobileScale: 130
		});
		expect(get(hearthConfig).keep_screen_on).toBeUndefined();
		expect(select(en.hearth_scale_at_900_px_and_narrower).selectedOptions[0].textContent).toBe(
			fill(en.hearth_same_as_interface_scale, { value: '130%' })
		);
	});

	it('names this device', async () => {
		render(ScreenEditSheet);
		await fireEvent.change(screen.getByLabelText(en.hearth_device_name), {
			target: { value: ' kitchen ' }
		});
		expect(get(deviceName)).toBe('kitchen');
		expect(localStorage.getItem('hearthDevice')).toBe('kitchen');
	});

	it('asks through the shared dialog before logging out', async () => {
		render(ScreenEditSheet);
		await fireEvent.click(screen.getByRole('button', { name: new RegExp(en.log_out) }));
		expect(get(requestedConfirmation)).toMatchObject({
			title: en.hearth_logout_confirm,
			message: en.hearth_logout_confirm_message,
			confirmLabel: en.log_out
		});
	});

	it('says the logout drops unsaved dashboard edits', async () => {
		enterEditMode();
		updateConfig((config) => {
			config.rooms[0].name = 'Renamed';
		});
		try {
			render(ScreenEditSheet);
			await fireEvent.click(screen.getByRole('button', { name: new RegExp(en.log_out) }));
			expect(get(requestedConfirmation)?.message).toBe(en.hearth_logout_confirm_edits_message);
		} finally {
			cancelEdit();
		}
	});

	it('closes from the header', async () => {
		render(ScreenEditSheet);
		await fireEvent.click(screen.getAllByRole('button', { name: en.hearth_close })[0]);
		expect(get(screenSheetOpen)).toBe(false);
	});
});
