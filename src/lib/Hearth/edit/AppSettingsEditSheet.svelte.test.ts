import { fireEvent, render, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	confirmRequestedAction,
	dismissConfirmation,
	editor,
	requestedConfirmation
} from '../store';
import AppSettingsEditSheet from './AppSettingsEditSheet.svelte';

function stageAChange() {
	return fireEvent.click(screen.getByRole('switch', { name: 'Reduce motion' }));
}

describe('AppSettingsEditSheet', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => null }));
		editor.set({ kind: 'appSettings' });
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		dismissConfirmation();
		editor.set(null);
	});

	it('closes straight away with nothing staged', async () => {
		render(AppSettingsEditSheet);
		await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
		expect(get(requestedConfirmation)).toBeNull();
		expect(get(editor)).toBeNull();
	});

	it('asks before close drops staged changes', async () => {
		render(AppSettingsEditSheet);
		await stageAChange();
		await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
		expect(get(editor)).toEqual({ kind: 'appSettings' });
		expect(get(requestedConfirmation)?.confirmLabel).toBe('Discard');
		confirmRequestedAction();
		expect(get(editor)).toBeNull();
	});

	it('asks before Escape drops staged changes', async () => {
		render(AppSettingsEditSheet);
		await stageAChange();
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
		expect(get(editor)).toEqual({ kind: 'appSettings' });
		expect(get(requestedConfirmation)).not.toBeNull();
	});

	it('asks before back drops staged changes', async () => {
		render(AppSettingsEditSheet);
		await stageAChange();
		await fireEvent.click(screen.getByRole('button', { name: 'Back' }));
		expect(get(editor)).toEqual({ kind: 'appSettings' });
		confirmRequestedAction();
		expect(get(editor)).toEqual({ kind: 'settings' });
	});

	it('asks before opening Custom CSS drops staged changes', async () => {
		render(AppSettingsEditSheet);
		await stageAChange();
		await fireEvent.click(screen.getByRole('button', { name: /Custom CSS/ }));
		expect(get(editor)).toEqual({ kind: 'appSettings' });
		confirmRequestedAction();
		expect(get(editor)).toEqual({ kind: 'customCss' });
	});

	it('closes without asking once a staged change is toggled back', async () => {
		render(AppSettingsEditSheet);
		await stageAChange();
		await stageAChange();
		await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
		expect(get(requestedConfirmation)).toBeNull();
		expect(get(editor)).toBeNull();
	});
});
