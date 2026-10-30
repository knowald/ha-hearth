import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configuration } from '$lib/core/app/configuration';
import { deviceName, saveDeviceName } from '$lib/core/app/device';
import { screenOverrides } from '$lib/core/app/screen';
import { fill } from '$lib/core/i18n';
import { english as en } from '$lib/core/i18n/testing';
import { DEFAULT_HEARTH_CONFIG } from '../config';
import { screenSettings, screenSheetOpen } from '../screen';
import {
	cancelEdit,
	confirmRequestedAction,
	dismissConfirmation,
	editor,
	enterEditMode,
	hearthConfig,
	requestedConfirmation,
	setupWizardOpen,
	updateConfig
} from '../store';
import SettingsEditSheet from './SettingsEditSheet.svelte';

/*
 * The settings sheet as a whole: its section list, search, change counts,
 * the footer that saves server settings, and the This screen sheet it
 * becomes outside edit mode. The rows themselves are covered in
 * SettingsEditSheet.svelte.test.ts.
 */

const saves: Record<string, unknown>[] = [];
let saveStatus = 200;
const scrollTo = vi.fn();

function section(id: string) {
	return document.querySelector<HTMLElement>(`[data-section="${id}"]`)!;
}

const nav = () => within(screen.getByRole('navigation', { name: en.hearth_settings_sections }));
const searchBox = () => screen.getByRole('searchbox', { name: en.hearth_search_settings });
const serverSwitch = (name: string) => within(section('server')).getByRole('switch', { name });
const select = (name: string) => screen.getByRole('combobox', { name }) as HTMLSelectElement;

beforeEach(() => {
	saves.length = 0;
	saveStatus = 200;
	scrollTo.mockClear();
	Element.prototype.scrollTo = scrollTo as never;
	configuration.set({ locale: 'en', revision: 4 } as never);
	hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
	vi.stubGlobal(
		'fetch',
		vi.fn(async (address: string, init?: RequestInit) => {
			if (address.endsWith('/_api/list_languages'))
				return { ok: true, json: async (): Promise<unknown> => ['en', 'de'] };
			if (!address.endsWith('/_api/save_config'))
				return { ok: false, json: async (): Promise<unknown> => null };
			saves.push(JSON.parse(String(init?.body)));
			return saveStatus === 200
				? { ok: true, status: 200, json: async (): Promise<unknown> => ({ revision: 5 }) }
				: {
						ok: false,
						status: saveStatus,
						json: async (): Promise<unknown> => ({ error: 'conflict', revision: 7 })
					};
		})
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
	delete (Element.prototype as { scrollTo?: unknown }).scrollTo;
	dismissConfirmation();
	editor.set(null);
	screenSheetOpen.set(false);
	setupWizardOpen.set(false);
	screenOverrides.set({});
	localStorage.removeItem('hearthScreen');
	configuration.set(undefined as never);
	hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
});

describe('settings search', () => {
	it('keeps the rows whose label or sub text match, in any case', async () => {
		render(SettingsEditSheet);
		await fireEvent.input(searchBox(), { target: { value: 'SCROLL EDGE' } });
		expect(screen.getByRole('switch', { name: en.hearth_scroll_edge_blur })).toBeTruthy();
		expect(screen.queryByRole('switch', { name: en.hearth_tile_animations })).toBeNull();

		await fireEvent.input(searchBox(), {
			target: { value: en.hearth_swipe_sideways_over_the_page.slice(0, 20) }
		});
		expect(
			screen.getByRole('switch', { name: en.hearth_swipe_between_pages_on_phones })
		).toBeTruthy();
		expect(screen.queryByRole('switch', { name: en.hearth_scroll_edge_blur })).toBeNull();
	});

	it('hides the sections without a match and brings them all back once cleared', async () => {
		render(SettingsEditSheet);
		await fireEvent.input(searchBox(), { target: { value: 'pixel shifting' } });
		expect(section('screen').hidden).toBe(false);
		expect(section('appearance').hidden).toBe(true);
		expect(section('server').hidden).toBe(true);
		// a page that matches keeps the pages section
		await fireEvent.input(searchBox(), { target: { value: 'home' } });
		expect(section('pages').hidden).toBe(false);

		await fireEvent.input(searchBox(), { target: { value: '' } });
		for (const element of document.querySelectorAll<HTMLElement>('[data-section]')) {
			expect(element.hidden).toBe(false);
		}
		expect(screen.getByRole('switch', { name: en.hearth_tile_animations })).toBeTruthy();
	});

	it('shows a whole section when the query names it', async () => {
		render(SettingsEditSheet);
		await fireEvent.input(searchBox(), { target: { value: 'server sett' } });
		expect(section('server').hidden).toBe(false);
		expect(serverSwitch(en.hearth_custom_js)).toBeTruthy();
		expect(serverSwitch(en.hearth_reduce_motion)).toBeTruthy();
		await fireEvent.input(searchBox(), { target: { value: en.hearth_maintenance } });
		expect(section('maintenance').hidden).toBe(false);
		expect(screen.getByRole('button', { name: new RegExp(en.hearth_versions) })).toBeTruthy();
		expect(section('appearance').hidden).toBe(true);
	});

	it('keeps a section with a save error through a search, so the alert is read once', async () => {
		saveStatus = 403;
		render(SettingsEditSheet);
		await fireEvent.click(serverSwitch(en.hearth_reduce_motion));
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_save_server_settings }));
		const alert = await screen.findByText(en.hearth_save_needs_admin);
		await fireEvent.input(searchBox(), { target: { value: 'pixel shifting' } });
		expect(section('server').hidden).toBe(false);
		expect(alert.isConnected).toBe(true);
	});

	it('leaves Escape to an input method that is composing', async () => {
		editor.set({ kind: 'settings' });
		render(SettingsEditSheet);
		const box = searchBox() as HTMLInputElement;
		await fireEvent.input(box, { target: { value: 'scale' } });
		await fireEvent.keyDown(box, { key: 'Escape', isComposing: true });
		expect(box.value).toBe('scale');
	});

	it('says when nothing matches, in a live region', async () => {
		render(SettingsEditSheet);
		const [status] = screen
			.getAllByRole('status')
			.filter((element) => element.classList.contains('no-match'));
		expect(status.textContent?.trim()).toBe('');
		await fireEvent.input(searchBox(), { target: { value: 'no such setting' } });
		expect(status.textContent?.trim()).toBe(en.hearth_no_matches);
	});

	it('clears a search on Escape and only then lets Escape close the sheet', async () => {
		editor.set({ kind: 'settings' });
		render(SettingsEditSheet);
		const box = searchBox() as HTMLInputElement;
		await fireEvent.input(box, { target: { value: 'pixel shifting' } });
		await fireEvent.keyDown(box, { key: 'Escape' });
		expect(box.value).toBe('');
		expect(section('appearance').hidden).toBe(false);
		expect(get(editor)).toEqual({ kind: 'settings' });

		await fireEvent.keyDown(box, { key: 'Escape' });
		expect(get(editor)).toBeNull();
	});

	it('clears the search when a section is picked from the list', async () => {
		render(SettingsEditSheet);
		await fireEvent.input(searchBox(), { target: { value: 'pixel shifting' } });
		await fireEvent.click(nav().getByRole('button', { name: en.hearth_alerts }));
		expect((searchBox() as HTMLInputElement).value).toBe('');
		expect(section('alerts').hidden).toBe(false);
	});
});

describe('settings section list', () => {
	it('groups the sections by where they are kept and marks the first one current', () => {
		render(SettingsEditSheet);
		const groups = [...document.querySelectorAll('.nav-group')].map((node) => node.textContent);
		expect(groups).toEqual([en.hearth_this_device, en.hearth_dashboard, en.hearth_server]);
		expect(
			nav().getByRole('button', { name: en.hearth_this_screen }).getAttribute('aria-current')
		).toBe('true');
	});

	it('scrolls a picked section into view and marks it current', async () => {
		render(SettingsEditSheet);
		Object.defineProperty(section('alerts'), 'offsetTop', { value: 900 });
		const alerts = nav().getByRole('button', { name: en.hearth_alerts });
		await fireEvent.click(alerts);
		await waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ top: 888, behavior: 'smooth' }));
		expect(alerts.getAttribute('aria-current')).toBe('true');
		expect(
			nav().getByRole('button', { name: en.hearth_this_screen }).getAttribute('aria-current')
		).toBeNull();
	});

	it('opens at the section it was asked for', async () => {
		render(SettingsEditSheet, { props: { section: 'server' } });
		expect(
			nav().getByRole('button', { name: en.hearth_server_settings }).getAttribute('aria-current')
		).toBe('true');
		await waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ top: -12, behavior: 'auto' }));
	});

	it('follows the scroll to the section at the top of the list', async () => {
		const { container } = render(SettingsEditSheet);
		const content = container.ownerDocument.querySelector<HTMLElement>('.settings-content')!;
		[...content.querySelectorAll<HTMLElement>('[data-section]')].forEach((element, index) =>
			Object.defineProperty(element, 'offsetTop', { value: index * 500 })
		);
		Object.defineProperty(content, 'clientHeight', { value: 400 });
		Object.defineProperty(content, 'scrollHeight', { value: 5000 });
		content.scrollTop = 1100;
		await fireEvent.scroll(content);
		expect(
			nav()
				.getByRole('button', { name: en.hearth_layout_and_navigation })
				.getAttribute('aria-current')
		).toBe('true');
	});
});

describe('settings section list after a search', () => {
	it('marks the section at the top again once the search is cleared', async () => {
		render(SettingsEditSheet);
		const content = document.querySelector<HTMLElement>('.settings-content')!;
		[...content.querySelectorAll<HTMLElement>('[data-section]')].forEach((element, index) =>
			Object.defineProperty(element, 'offsetTop', { value: index * 500 })
		);
		Object.defineProperty(content, 'clientHeight', { value: 400 });
		Object.defineProperty(content, 'scrollHeight', { value: 5000 });
		await fireEvent.input(searchBox(), { target: { value: 'pixel shifting' } });
		// the list stays where it was, so no scroll event follows the clear
		content.scrollTop = 1600;
		await fireEvent.input(searchBox(), { target: { value: '' } });
		await waitFor(() =>
			expect(
				nav().getByRole('button', { name: en.hearth_size_and_spacing }).getAttribute('aria-current')
			).toBe('true')
		);
	});
});

describe('settings change counts', () => {
	it('counts the settings changed since the sheet opened, per section and in the footer', async () => {
		render(SettingsEditSheet);
		expect(screen.getByText(en.hearth_settings_status_idle)).toBeTruthy();

		await fireEvent.click(screen.getByRole('switch', { name: en.hearth_tile_animations }));
		const appearance = nav().getByRole('button', { name: new RegExp(en.hearth_appearance) });
		expect(appearance.textContent).toContain(fill(en.hearth_settings_changed_count, { count: 1 }));
		expect(screen.getByText(en.hearth_dashboard_changes_one)).toBeTruthy();

		await fireEvent.click(screen.getByRole('switch', { name: en.hearth_scroll_edge_blur }));
		await fireEvent.change(screen.getByLabelText(en.hearth_sidebar), {
			target: { value: 'right' }
		});
		expect(appearance.textContent).toContain(fill(en.hearth_settings_changed_count, { count: 2 }));
		expect(
			screen.getByText(fill(en.hearth_dashboard_changes, { count: 3 }), { exact: false })
		).toBeTruthy();

		// a setting put back is no longer a change
		await fireEvent.click(screen.getByRole('switch', { name: en.hearth_tile_animations }));
		expect(appearance.textContent).toContain(fill(en.hearth_settings_changed_count, { count: 1 }));
	});

	it('counts from the start of edit mode, so a trip to another editor keeps the count', async () => {
		enterEditMode();
		try {
			editor.set({ kind: 'settings' });
			const first = render(SettingsEditSheet);
			await fireEvent.click(screen.getByRole('switch', { name: en.hearth_tile_animations }));
			await fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${en.theme}`) }));
			expect(get(editor)).toEqual({ kind: 'theme' });
			first.unmount();

			editor.set({ kind: 'settings', section: 'appearance' });
			render(SettingsEditSheet, { props: { section: 'appearance' } });
			expect(screen.getByText(en.hearth_dashboard_changes_one)).toBeTruthy();
			expect(
				nav().getByRole('button', { name: new RegExp(en.hearth_appearance) }).textContent
			).toContain(fill(en.hearth_settings_changed_count, { count: 1 }));
		} finally {
			cancelEdit();
		}
	});

	it('counts a theme change made in the theme sheet under Appearance', async () => {
		enterEditMode();
		try {
			updateConfig((config) => {
				config.theme = { ...config.theme, accent: '#ff8800' };
			});
			render(SettingsEditSheet);
			expect(screen.getByText(en.hearth_dashboard_changes_one)).toBeTruthy();
			expect(
				nav().getByRole('button', { name: new RegExp(en.hearth_appearance) }).textContent
			).toContain(fill(en.hearth_settings_changed_count, { count: 1 }));
		} finally {
			cancelEdit();
		}
	});

	it("counts this screen's own choices beside the section, not in the footer", async () => {
		render(SettingsEditSheet);
		await fireEvent.click(
			within(section('screen')).getByRole('switch', { name: en.hearth_pixel_shifting })
		);
		expect(
			nav().getByRole('button', { name: new RegExp(en.hearth_this_screen) }).textContent
		).toContain(fill(en.hearth_settings_changed_count, { count: 1 }));
		expect(screen.getByText(en.hearth_settings_status_idle)).toBeTruthy();
	});
});

describe('server settings in the footer', () => {
	const save = () => screen.getByRole('button', { name: en.hearth_save_server_settings });

	it('offers Save and Discard only while a server value is staged', async () => {
		render(SettingsEditSheet);
		expect(screen.queryByRole('button', { name: en.hearth_save_server_settings })).toBeNull();
		await fireEvent.click(serverSwitch(en.hearth_reduce_motion));
		expect(screen.getByText(en.hearth_unsaved_server_settings_one)).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_discard }));
		expect(serverSwitch(en.hearth_reduce_motion).getAttribute('aria-checked')).toBe('false');
		expect(screen.queryByRole('button', { name: en.hearth_save_server_settings })).toBeNull();
	});

	it('saves to the server, says so and stays open', async () => {
		editor.set({ kind: 'settings' });
		render(SettingsEditSheet);
		await fireEvent.click(serverSwitch(en.hearth_reduce_motion));
		await fireEvent.click(serverSwitch(en.hearth_custom_js));
		expect(
			screen.getByText(fill(en.hearth_unsaved_server_settings, { count: 2 }), { exact: false })
		).toBeTruthy();
		await fireEvent.click(save());
		await screen.findByText(en.hearth_server_settings_saved);
		expect(saves).toEqual([{ locale: 'en', revision: 4, motion: false, custom_js: true }]);
		expect(get(configuration)?.revision).toBe(5);
		expect(get(editor)).toEqual({ kind: 'settings' });
		expect(screen.queryByRole('button', { name: en.hearth_save_server_settings })).toBeNull();

		// the next change replaces the saved note
		await fireEvent.click(serverSwitch(en.hearth_custom_js));
		expect(screen.queryByText(en.hearth_server_settings_saved)).toBeNull();
	});

	it('keeps a change made while the save was in flight as unsaved', async () => {
		let answer: (value: unknown) => void = () => {};
		vi.stubGlobal(
			'fetch',
			vi.fn((address: string) =>
				address.endsWith('/_api/save_config')
					? new Promise((resolve) => (answer = resolve))
					: Promise.resolve({ ok: false, json: async (): Promise<unknown> => null })
			)
		);
		render(SettingsEditSheet);
		await fireEvent.click(serverSwitch(en.hearth_reduce_motion));
		await fireEvent.click(save());
		await fireEvent.click(serverSwitch(en.hearth_custom_js));
		answer({ ok: true, status: 200, json: async () => ({ revision: 5 }) });
		await waitFor(() => expect(get(configuration)?.revision).toBe(5));
		expect(screen.getByText(en.hearth_unsaved_server_settings_one)).toBeTruthy();
		expect(save()).toBeTruthy();
	});

	it("shows the shared values, not this screen's own", () => {
		configuration.set({ locale: 'en', motion: false } as never);
		screenOverrides.set({ reduce_motion: false });
		render(SettingsEditSheet);
		expect(serverSwitch(en.hearth_reduce_motion).getAttribute('aria-checked')).toBe('true');
	});

	it('explains a conflict and overwrites with the revision the server returned', async () => {
		saveStatus = 409;
		render(SettingsEditSheet);
		await fireEvent.click(serverSwitch(en.hearth_reduce_motion));
		await fireEvent.click(save());
		const alert = await screen.findByRole('alert');
		expect(alert.textContent).toContain(en.hearth_app_settings_changed);
		expect(alert.textContent).not.toContain('409');
		expect(screen.getByRole('button', { name: en.hearth_reload })).toBeTruthy();

		saveStatus = 200;
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_overwrite }));
		expect(get(requestedConfirmation)?.title).toBe(en.hearth_overwrite_newer_app_settings);
		confirmRequestedAction();
		await screen.findByText(en.hearth_server_settings_saved);
		expect(saves.map((body) => body.revision)).toEqual([4, 7]);
		expect(get(configuration)?.revision).toBe(5);
	});

	it('jumps to the section when a save fails, where the error is', async () => {
		saveStatus = 403;
		render(SettingsEditSheet);
		await fireEvent.click(serverSwitch(en.hearth_reduce_motion));
		await fireEvent.click(save());
		await screen.findByText(en.hearth_save_needs_admin);
		expect(
			nav()
				.getByRole('button', { name: new RegExp(en.hearth_server_settings) })
				.getAttribute('aria-current')
		).toBe('true');
	});
});

describe('closing with staged server values', () => {
	beforeEach(() => editor.set({ kind: 'settings' }));

	const stage = () => fireEvent.click(serverSwitch(en.hearth_reduce_motion));

	it('closes straight away with nothing staged', async () => {
		render(SettingsEditSheet);
		await fireEvent.click(screen.getAllByRole('button', { name: en.hearth_close })[0]);
		expect(get(requestedConfirmation)).toBeNull();
		expect(get(editor)).toBeNull();
	});

	it.each([0, 1])('asks before close button %i drops them', async (index) => {
		render(SettingsEditSheet);
		await stage();
		await fireEvent.click(screen.getAllByRole('button', { name: en.hearth_close })[index]);
		expect(get(editor)).toEqual({ kind: 'settings' });
		expect(get(requestedConfirmation)?.confirmLabel).toBe(en.hearth_discard);
		confirmRequestedAction();
		expect(get(editor)).toBeNull();
	});

	it('asks before Escape drops them', async () => {
		render(SettingsEditSheet);
		await stage();
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
		expect(get(editor)).toEqual({ kind: 'settings' });
		expect(get(requestedConfirmation)).not.toBeNull();
	});

	it('asks before another editor replaces the sheet', async () => {
		render(SettingsEditSheet);
		await stage();
		await fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${en.theme}`) }));
		expect(get(editor)).toEqual({ kind: 'settings' });
		confirmRequestedAction();
		expect(get(editor)).toEqual({ kind: 'theme' });
	});

	it.each([en.hearth_setup, en.hearth_starter_layouts])(
		'asks before %s opens the setup wizard, which closes the sheet when done',
		async (label) => {
			render(SettingsEditSheet);
			await stage();
			await fireEvent.click(screen.getByRole('button', { name: new RegExp(label) }));
			expect(get(setupWizardOpen)).toBe(false);
			expect(get(requestedConfirmation)?.confirmLabel).toBe(en.hearth_discard);
			confirmRequestedAction();
			expect(get(setupWizardOpen)).toBe(true);
		}
	);

	it('says a log out drops them', async () => {
		render(SettingsEditSheet);
		await stage();
		await fireEvent.click(screen.getByRole('button', { name: new RegExp(en.log_out) }));
		expect(get(requestedConfirmation)?.message).toBe(en.hearth_logout_confirm_unsaved_message);
	});

	it('closes without asking once the staged value is put back', async () => {
		render(SettingsEditSheet);
		await stage();
		await stage();
		await fireEvent.click(screen.getAllByRole('button', { name: en.hearth_close })[0]);
		expect(get(requestedConfirmation)).toBeNull();
		expect(get(editor)).toBeNull();
	});
});

describe('This screen outside edit mode', () => {
	beforeEach(() => {
		hearthConfig.set({ ...structuredClone(DEFAULT_HEARTH_CONFIG), screensaver_minutes: 5 });
		screenSheetOpen.set(true);
	});

	afterEach(() => saveDeviceName(''));

	const renderScreen = () => render(SettingsEditSheet, { props: { screenOnly: true } });

	it('shows This screen alone, without the section list, search or footer', () => {
		renderScreen();
		expect(screen.getByRole('dialog', { name: en.hearth_this_screen })).toBeTruthy();
		const sections = [...document.querySelectorAll<HTMLElement>('[data-section]')];
		expect(sections.map((node) => node.dataset.section)).toEqual(['screen']);
		expect(screen.queryByRole('navigation')).toBeNull();
		expect(screen.queryByRole('searchbox')).toBeNull();
		expect(screen.queryByText(en.hearth_settings_status_idle)).toBeNull();
	});

	it('says where its settings live and starts every row at the shared value', () => {
		renderScreen();
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
		renderScreen();
		await fireEvent.change(select(en.hearth_screensaver), { target: { value: '0' } });
		expect(get(screenSettings).sleepMinutes).toBe(0);
		expect(JSON.parse(localStorage.getItem('hearthScreen')!)).toEqual({ screensaver_minutes: 0 });

		await fireEvent.change(select(en.hearth_screensaver), { target: { value: '' } });
		expect(get(screenSettings).sleepMinutes).toBe(5);
		expect(localStorage.getItem('hearthScreen')).toBeNull();
	});

	it('enables pixel shifting for this browser and removes the override when turned off', async () => {
		renderScreen();
		const toggle = screen.getByRole('switch', { name: en.hearth_pixel_shifting });
		await fireEvent.click(toggle);
		expect(get(screenOverrides).pixel_shift).toBe(true);
		expect(JSON.parse(localStorage.getItem('hearthScreen')!).pixel_shift).toBe(true);
		await fireEvent.click(toggle);
		expect(get(screenOverrides).pixel_shift).toBeUndefined();
		expect(localStorage.getItem('hearthScreen')).toBeNull();
	});

	it('keeps the wake lock and scale for this screen alone', async () => {
		renderScreen();
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

	it('mutes alert chimes on this screen alone', async () => {
		renderScreen();
		await fireEvent.change(select(en.hearth_mute_alert_chimes), { target: { value: 'on' } });
		expect(get(screenOverrides).mute_chimes).toBe(true);
		expect(JSON.parse(localStorage.getItem('hearthScreen')!)).toEqual({ mute_chimes: true });
		await fireEvent.change(select(en.hearth_mute_alert_chimes), { target: { value: '' } });
		expect(get(screenOverrides).mute_chimes).toBeUndefined();
	});

	it('says where the browser cannot scale', () => {
		renderScreen();
		// jsdom has no standardized CSS zoom
		expect(screen.getAllByText(en.hearth_scale_unsupported)).toHaveLength(2);
	});

	it('names a chosen language even before or without the list', () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({ ok: false, json: async (): Promise<unknown> => null }))
		);
		screenOverrides.set({ locale: 'pl' });
		renderScreen();
		expect(select(en.language).selectedOptions[0].textContent).toBe('Polski');
	});

	it('names this device', async () => {
		renderScreen();
		await fireEvent.change(screen.getByLabelText(en.hearth_device_name), {
			target: { value: ' kitchen ' }
		});
		expect(get(deviceName)).toBe('kitchen');
		expect(localStorage.getItem('hearthDevice')).toBe('kitchen');
	});

	it('asks through the shared dialog before logging out', async () => {
		renderScreen();
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
			renderScreen();
			await fireEvent.click(screen.getByRole('button', { name: new RegExp(en.log_out) }));
			expect(get(requestedConfirmation)?.message).toBe(en.hearth_logout_confirm_edits_message);
		} finally {
			cancelEdit();
		}
	});

	it('closes from the header', async () => {
		renderScreen();
		await fireEvent.click(screen.getAllByRole('button', { name: en.hearth_close })[0]);
		expect(get(screenSheetOpen)).toBe(false);
	});
});
