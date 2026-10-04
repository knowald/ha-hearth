import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { customCss } from '$lib/ui/CustomCss.svelte';
import { editor } from '../store';
import CustomCssEditSheet from './CustomCssEditSheet.svelte';

function stubServer() {
	const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
		init?.method === 'POST'
			? { ok: true, json: async () => ({}) }
			: { ok: true, json: async () => '.card { color: red; }' }
	);
	vi.stubGlobal('fetch', fetchMock);
	return fetchMock;
}

describe('CustomCssEditSheet', () => {
	// the sheet loads CodeMirror on demand; transforming it cold under a loaded
	// suite can outlast waitFor's timeout, so it is loaded before the tests
	beforeAll(async () => {
		await import('$lib/ui/CodeEditor.svelte');
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		customCss.set('');
		editor.set(null);
	});

	it('applies the saved stylesheet in place and returns to Settings', async () => {
		const fetchMock = stubServer();
		editor.set({ kind: 'customCss' });
		const { container } = render(CustomCssEditSheet);
		await waitFor(() => expect(container.querySelector('.cm-editor')).toBeTruthy());

		await fireEvent.click(screen.getByRole('button', { name: 'Save' }));

		await waitFor(() => expect(get(customCss)).toBe('.card { color: red; }'));
		expect(fetchMock).toHaveBeenCalledWith(
			'/_api/custom_css',
			expect.objectContaining({ method: 'POST' })
		);
		// back to Settings, where Custom CSS was opened from
		expect(get(editor)).toEqual({ kind: 'settings' });
	});

	it('saves on cmd+s inside the editor', async () => {
		const fetchMock = stubServer();
		const { container } = render(CustomCssEditSheet);
		await waitFor(() => expect(container.querySelector('.cm-content')).toBeTruthy());

		const event = new KeyboardEvent('keydown', {
			key: 's',
			ctrlKey: true,
			bubbles: true,
			cancelable: true
		});
		container.querySelector('.cm-content')!.dispatchEvent(event);

		expect(event.defaultPrevented).toBe(true);
		await waitFor(() =>
			expect(fetchMock).toHaveBeenCalledWith(
				'/_api/custom_css',
				expect.objectContaining({ method: 'POST' })
			)
		);
	});
});
