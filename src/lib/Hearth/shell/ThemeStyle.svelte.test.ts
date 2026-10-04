import { act, render } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { motion } from '$lib/core/app/motion';
import { MOTION, THEME_DEFAULTS } from '$lib/core/theme';
import type { HearthConfig } from '../types';
import { DEFAULT_HEARTH_CONFIG } from '../config';
import { hearthConfig } from '../store';
import ThemeStyle from './ThemeStyle.svelte';
import dashboardSource from '../HearthDashboard.svelte?raw';

const zoom = vi.hoisted(() => ({ zoomSupported: true }));
vi.mock('../zoom', () => zoom);

describe('ThemeStyle', () => {
	afterEach(() => {
		motion.set(MOTION.base);
		delete document.documentElement.dataset.motion;
	});

	it('marks the root and zeroes the motion tokens when motion is off', async () => {
		render(ThemeStyle);
		expect(document.documentElement.dataset.motion).toBeUndefined();

		await act(() => motion.set(0));
		expect(document.documentElement.dataset.motion).toBe('off');
		const css = document.head.innerHTML;
		for (const name of Object.keys(MOTION)) {
			expect(css).toMatch(
				new RegExp(`:root\\[data-motion='off'\\] \\{[^}]*--h-motion-${name}: 0ms;`)
			);
		}

		await act(() => motion.set(MOTION.base));
		expect(document.documentElement.dataset.motion).toBeUndefined();
	});

	it('stops the pending pulse and press scale on the dashboard when motion is off', () => {
		const rule = (selector: string) =>
			dashboardSource.match(
				new RegExp(`html\\[data-motion='off'\\]\\) \\.frame :global\\(${selector}\\) \\{([^}]*)\\}`)
			)?.[1];
		expect(rule('\\.pending')).toMatch(/animation: none;/);
		expect(rule('\\.pending')).toMatch(/opacity:/);
		expect(rule('\\.pressable:active')).toMatch(/transform: none;/);
	});
});

describe('ThemeStyle scale output', () => {
	function renderCss(config: Partial<HearthConfig>) {
		hearthConfig.set({ ...structuredClone(DEFAULT_HEARTH_CONFIG), ...config });
		render(ThemeStyle);
		return document.head.innerHTML;
	}

	beforeEach(() => {
		document.head.replaceChildren();
		zoom.zoomSupported = true;
	});

	afterEach(() => {
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
	});

	it('zooms the root and undoes the zoom for viewport units and safe areas', () => {
		const css = renderCss({ scale: 150 });
		expect(css).toContain('--h-zoom: 1.5; zoom: var(--h-zoom);');
		expect(css).toContain('--h-vh: calc(1vh / var(--h-zoom));');
		expect(css).toContain(
			'--h-safe-bottom: calc(env(safe-area-inset-bottom, 0px) / var(--h-zoom));'
		);
		expect(css).toContain('@supports (height: 1dvh)');
		expect(css).not.toContain('@media (max-width: 900px)');
	});

	it('overrides the zoom and padding at the phone breakpoint', () => {
		const css = renderCss({ scale: 150, mobile_scale: 80, mobile_padding_x: 0, padding_x: 24 });
		expect(css).toContain('--h-pad-x: 24px;');
		expect(css).toContain('@media (max-width: 900px) { :root { --h-pad-x: 0px; --h-zoom: 0.8; } }');
	});

	it('stays at 100% where standardized zoom is missing', () => {
		zoom.zoomSupported = false;
		const css = renderCss({ scale: 150, mobile_scale: 80 });
		expect(css).toContain('--h-zoom: 1;');
		expect(css).not.toContain('--h-zoom: 0.8');
	});
});

describe('ThemeStyle theme tokens', () => {
	beforeEach(() => document.head.replaceChildren());
	afterEach(() => hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG)));

	function themeRule() {
		const element = document.head.querySelector<HTMLStyleElement>('style[data-hearth-theme]');
		return (element?.sheet?.cssRules[0] as CSSStyleRule).style;
	}

	it('sets each token on its own property, defaults under the theme', () => {
		hearthConfig.set({
			...structuredClone(DEFAULT_HEARTH_CONFIG),
			theme: { accent: '#3366ff', text_2: '#abcdef' }
		});
		render(ThemeStyle);
		expect(themeRule().getPropertyValue('--h-accent-rgb')).toBe('51 102 255');
		expect(themeRule().getPropertyValue('--h-text-2')).toBe('#abcdef');
		expect(themeRule().getPropertyValue('--h-text-1')).toBe(THEME_DEFAULTS.text_1);
	});

	it('keeps a hostile value inside its property', () => {
		hearthConfig.set({
			...structuredClone(DEFAULT_HEARTH_CONFIG),
			theme: {
				accent: 'red; display: none',
				text_1: '#fff /*',
				text_2: 'red; } :root { display: none',
				text_3: '#abcdef'
			}
		});
		render(ThemeStyle);
		// nothing from a theme reaches stylesheet text
		expect(document.head.innerHTML).not.toContain('display: none');
		const rule = document.head.querySelector<HTMLStyleElement>('style[data-hearth-theme]')!.sheet!
			.cssRules;
		expect(rule).toHaveLength(1);
		expect(themeRule().getPropertyValue('display')).toBe('');
		expect(themeRule().getPropertyValue('--h-text-3')).toBe('#abcdef');
	});

	it('goes ahead of the custom CSS, which may override any token', () => {
		const custom = document.createElement('style');
		custom.id = 'ha-hearth-custom-css';
		document.head.append(custom);
		render(ThemeStyle);
		expect(custom.previousElementSibling?.hasAttribute('data-hearth-theme')).toBe(true);
	});
});
