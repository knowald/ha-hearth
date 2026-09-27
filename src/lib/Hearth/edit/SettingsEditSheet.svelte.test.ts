import { fireEvent, render, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, describe, expect, it } from 'vitest';
import en from '../../../../static/translations/en.json';
import { DEFAULT_HEARTH_CONFIG } from '../config';
import { editor, hearthConfig, setupWizardOpen } from '../store';
import SettingsEditSheet from './SettingsEditSheet.svelte';

describe('SettingsEditSheet', () => {
	afterEach(() => {
		editor.set(null);
		setupWizardOpen.set(false);
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
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
});
