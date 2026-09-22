import { render, screen } from '@testing-library/svelte';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { commandFailure } from '$lib/core/ha/commands';
import { LAYERS } from '$lib/core/theme';
import Toasts from './Toasts.svelte';
import source from './Toasts.svelte?raw';

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
	afterEach(() => commandFailure.set(null));

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
