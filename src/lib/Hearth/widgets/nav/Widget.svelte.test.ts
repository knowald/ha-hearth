import { render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_HEARTH_CONFIG } from '../../config';
import { hearthConfig, hearthEditMode } from '../../store';
import Widget from './Widget.svelte';

describe('nav widget reordering', () => {
	afterEach(() => {
		hearthEditMode.set(false);
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
	});

	it('gives every page the drag handle cards and widgets use while editing', () => {
		hearthEditMode.set(true);
		const { container } = render(Widget, { widget: { id: 'nav', type: 'nav' } });
		const pages = container.querySelectorAll('.nav-item[data-id]');
		expect(pages.length).toBeGreaterThan(0);
		for (const page of pages) expect(page.querySelector('.drag-handle')).toBeTruthy();
	});

	it('shows no handle outside edit mode', () => {
		const { container } = render(Widget, { widget: { id: 'nav', type: 'nav' } });
		expect(container.querySelector('.drag-handle')).toBeNull();
	});
});
