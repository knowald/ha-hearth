import { render } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pushLayer } from '$lib/ui/layers';
import { DEFAULT_HEARTH_CONFIG } from '../config';
import {
	cancelEdit,
	editor,
	enterEditMode,
	hearthConfig,
	hearthEditMode,
	updateConfig
} from '../store';
import Keyboard from './Keyboard.svelte';

function press(key: string, init: KeyboardEventInit = {}) {
	const event = new KeyboardEvent('keydown', { key, cancelable: true, ...init });
	window.dispatchEvent(event);
	return event;
}

describe('Keyboard', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		editor.set(null);
		if (get(hearthEditMode)) cancelEdit();
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
	});

	it('opens search on f only when a search widget exists and nothing is layered', () => {
		const onsearch = vi.fn();
		render(Keyboard, { onsearch });
		hearthConfig.set({ ...structuredClone(DEFAULT_HEARTH_CONFIG), rail: [] });
		press('f');
		expect(onsearch).not.toHaveBeenCalled();
		hearthConfig.set({
			...structuredClone(DEFAULT_HEARTH_CONFIG),
			rail: [{ id: 'search', type: 'search' }]
		});
		const release = pushLayer(() => {});
		press('f');
		expect(onsearch).not.toHaveBeenCalled();
		release();
		press('f');
		expect(onsearch).toHaveBeenCalledTimes(1);
	});

	it('ignores f while the only search widget is hidden', () => {
		const onsearch = vi.fn();
		render(Keyboard, { onsearch });
		hearthConfig.set({
			...structuredClone(DEFAULT_HEARTH_CONFIG),
			rail: [{ id: 'search', type: 'search', visibility: [{ entity: 'input_boolean.missing' }] }]
		});
		press('f');
		expect(onsearch).not.toHaveBeenCalled();

		// hidden on mobile only counts while the rail is folded
		vi.stubGlobal('matchMedia', () => ({ matches: true }));
		hearthConfig.set({
			...structuredClone(DEFAULT_HEARTH_CONFIG),
			rail: [{ id: 'search', type: 'search', mobile: 'hidden' }]
		});
		press('f');
		expect(onsearch).not.toHaveBeenCalled();
		vi.stubGlobal('matchMedia', () => ({ matches: false }));
		press('f');
		expect(onsearch).toHaveBeenCalledTimes(1);
	});

	it('undoes and redoes with cmd+z while editing', () => {
		render(Keyboard, { onsearch: () => {} });
		enterEditMode();
		updateConfig((config) => {
			config.padding_x = 42;
		});
		press('z', { metaKey: true });
		expect(get(hearthConfig).padding_x).not.toBe(42);
		press('z', { metaKey: true, shiftKey: true });
		expect(get(hearthConfig).padding_x).toBe(42);
	});

	it('keeps cmd+s from the browser save dialog while a sheet is open, without saving', () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		render(Keyboard, { onsearch: () => {} });
		enterEditMode();
		editor.set({ kind: 'customCss' });
		const event = press('s', { metaKey: true });
		expect(event.defaultPrevented).toBe(true);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('leaves undo to an open sheet', () => {
		render(Keyboard, { onsearch: () => {} });
		enterEditMode();
		updateConfig((config) => {
			config.padding_x = 42;
		});
		editor.set({ kind: 'theme' });
		const event = press('z', { metaKey: true });
		expect(event.defaultPrevented).toBe(false);
		expect(get(hearthConfig).padding_x).toBe(42);
	});
});
