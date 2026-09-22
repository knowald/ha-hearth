import { fireEvent, render, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, describe, expect, it } from 'vitest';
import en from '../../../../static/translations/en.json';
import { editor, setupWizardOpen } from '../store';
import SettingsEditSheet from './SettingsEditSheet.svelte';

describe('SettingsEditSheet', () => {
	afterEach(() => {
		editor.set(null);
		setupWizardOpen.set(false);
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
