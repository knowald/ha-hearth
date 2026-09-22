import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../static/translations/en.json';
import { DEFAULT_HEARTH_CONFIG } from '../config';
import { editor, hearthConfig } from '../store';
import { configDocument } from '../transfer';
import VersionsEditSheet from './VersionsEditSheet.svelte';

function stubServer(content: string) {
	vi.stubGlobal(
		'fetch',
		vi.fn(async (address: string | URL) =>
			String(address).includes('name=')
				? { ok: true, json: async () => ({ content }) }
				: { ok: true, json: async () => ({ versions: [], revision: 3 }) }
		)
	);
}

function closeAction() {
	// the text action, beside the icon-only close button that shares its name
	return screen
		.getAllByRole('button', { name: en.hearth_close })
		.find((button) => button.classList.contains('primary'))!;
}

describe('VersionsEditSheet', () => {
	beforeEach(() => {
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
		editor.set({ kind: 'versions' });
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		editor.set(null);
	});

	it('closes from the header even when the version matches the dashboard', async () => {
		stubServer(configDocument(get(hearthConfig)));
		render(VersionsEditSheet);
		await waitFor(() => expect(screen.getByText(en.hearth_versions_identical)).toBeTruthy());
		const close = closeAction();
		expect(close.hasAttribute('disabled')).toBe(false);
		await fireEvent.click(close);
		expect(get(editor)).toBeNull();
	});

	it('leaves restoring to the toolbar, so closing changes nothing', async () => {
		const changed = structuredClone(DEFAULT_HEARTH_CONFIG);
		changed.rooms = [{ id: 'den', name: 'Den', icon: 'sofa', cards: [[]] }];
		stubServer(configDocument(changed));
		const before = get(hearthConfig);
		render(VersionsEditSheet);
		await waitFor(() => expect(screen.getByText(en.hearth_versions_diff)).toBeTruthy());
		await fireEvent.click(closeAction());
		expect(get(hearthConfig)).toBe(before);
	});

	it('goes back to settings when opened from there', async () => {
		stubServer(configDocument(get(hearthConfig)));
		render(VersionsEditSheet, { from: { kind: 'settings' } });
		await fireEvent.click(screen.getByRole('button', { name: en.back }));
		expect(get(editor)).toEqual({ kind: 'settings' });
	});

	it('goes back to the code editor with its draft and opener', async () => {
		stubServer(configDocument(get(hearthConfig)));
		const code = { kind: 'code', draft: 'x: 1\n', from: { kind: 'settings' } } as const;
		render(VersionsEditSheet, { from: code });
		await fireEvent.click(screen.getByRole('button', { name: en.back }));
		expect(get(editor)).toEqual(code);
	});
});
