import { render, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CustomCss, { customCss } from './CustomCss.svelte';

function sheet() {
	return document.getElementById('ha-hearth-custom-css');
}

describe('CustomCss', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		customCss.set('');
	});

	it('applies the saved file and restyles when it changes, without a reload', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({ ok: true, json: async () => 'body { color: red; }' })
		);
		const { unmount } = render(CustomCss);
		await waitFor(() => expect(sheet()?.textContent).toBe('body { color: red; }'));

		customCss.set('body { color: blue; }');
		await tick();
		expect(document.querySelectorAll('#ha-hearth-custom-css')).toHaveLength(1);
		expect(sheet()?.textContent).toBe('body { color: blue; }');

		customCss.set('');
		await tick();
		expect(sheet()).toBeNull();

		customCss.set('a {}');
		await tick();
		unmount();
		expect(sheet()).toBeNull();
	});
});
