import { act, render, screen } from '@testing-library/svelte';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { commandFailure } from '$lib/core/ha/commands';
import { health } from '$lib/core/ha/connection';
import { configurationLoadError, hearthLoadError, hearthLoadErrorKind } from '../store';
import { LAYERS } from '$lib/core/theme';
import Toasts from './Toasts.svelte';
import source from './Toasts.svelte?raw';
import en from '../../../../static/translations/en.json';

function zIndexOf(selector: string) {
	const rule = source.match(new RegExp(`\\n\\t${selector.replace('.', '\\.')} \\{([^}]*)\\}`));
	return rule?.[1].match(/z-index:\s*([^;]+);/)?.[1];
}

describe('Toasts', () => {
	// jsdom has no Web Animations; Svelte transitions call element.animate
	beforeAll(() => {
		Element.prototype.animate ??= () =>
			({ cancel() {}, finished: Promise.resolve() }) as unknown as Animation;
	});
	afterEach(() => {
		commandFailure.set(null);
		hearthLoadError.set(null);
		hearthLoadErrorKind.set(null);
		configurationLoadError.set(null);
		health.set('booting');
		vi.useRealTimers();
	});

	async function settle(state: 'booting' | 'connected' | 'degraded' | 'lost') {
		vi.useFakeTimers();
		render(Toasts);
		await act(() => health.set(state));
		await act(() => vi.advanceTimersByTime(2100));
	}

	it('reports a lost connection as lost', async () => {
		await settle('lost');
		expect(screen.getByRole('status').textContent).toContain(en.hearth_connection_lost);
	});

	it('reports a degraded connection with its own calmer message instead of the lost banner', async () => {
		await settle('degraded');
		const status = screen.getByRole('status');
		expect(status.textContent).toContain(en.hearth_connection_degraded);
		expect(status.textContent).not.toContain(en.hearth_connection_lost);
	});

	it.each(['booting', 'connected'] as const)(
		'shows no connection banner while %s',
		async (state) => {
			await settle(state);
			expect(screen.queryByRole('status')).toBeNull();
		}
	);

	it.each([
		[
			'version',
			'Hearth configuration version 1 is unsupported; expected 2',
			'hearth_config_version_unsupported'
		],
		[
			'unreadable',
			'Hearth configuration could not be loaded: bad indentation',
			'hearth_config_unreadable'
		],
		['invalid', 'rooms[0].id is missing', 'hearth_config_invalid']
	] as const)('titles a %s load error by its kind and keeps the detail', (kind, detail, title) => {
		hearthLoadError.set(detail);
		hearthLoadErrorKind.set(kind);
		render(Toasts);
		const alert = screen.getByRole('alert');
		expect(alert.querySelector('strong')?.textContent).toBe(en[title as keyof typeof en]);
		expect(alert.textContent).toContain(detail);
		expect(screen.getByRole('button', { name: en.hearth_reload })).toBeTruthy();
	});

	it('reports an unreadable configuration.yaml with a reload action', () => {
		configurationLoadError.set('bad indentation of a mapping entry');
		render(Toasts);
		const alert = screen.getByRole('alert');
		expect(alert.querySelector('strong')?.textContent).toBe(en.hearth_settings_file_unreadable);
		expect(alert.textContent).toContain('bad indentation of a mapping entry');
		expect(screen.getByRole('button', { name: en.hearth_reload })).toBeTruthy();
	});

	it('shows a failed command as an alert', () => {
		commandFailure.set({ entityId: 'light.kitchen', detail: 'unavailable' });
		render(Toasts);
		expect(screen.getByRole('alert').textContent).toContain('light.kitchen');
	});

	it('draws command and connection errors above every open overlay but the confirm dialog', () => {
		expect(zIndexOf('.command-error')).toBe('var(--h-layer-alert)');
		expect(zIndexOf('.connection-toast')).toBe('var(--h-layer-alert)');
		for (const below of ['popup', 'search', 'sheet', 'sheet-popover', 'picker']) {
			expect(LAYERS.alert).toBeGreaterThan(LAYERS[below]);
		}
		expect(LAYERS.alert).toBeLessThan(LAYERS.confirm);
		expect(LAYERS.alert).toBeLessThan(LAYERS.screensaver);
	});
});
