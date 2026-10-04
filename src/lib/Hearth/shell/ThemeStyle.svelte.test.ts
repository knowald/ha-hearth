import { act, render } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { motion } from '$lib/core/app/motion';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import { BACKGROUND_SCRIMS, MOTION, THEME_DEFAULTS, THEME_PRESETS } from '$lib/core/theme';
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

describe('ThemeStyle schedule and page look', () => {
	const IMAGE = 'hearth-images/0123456789abcdef0123456789abcdef.webp';
	const presetTheme = (id: string) => THEME_PRESETS.find((preset) => preset.id === id)!.theme!;

	beforeEach(() => document.head.replaceChildren());
	afterEach(() => {
		vi.useRealTimers();
		motion.set(MOTION.base);
		document.documentElement.classList.remove('theme-fade');
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
	});

	function themeRule() {
		const element = document.head.querySelector<HTMLStyleElement>('style[data-hearth-theme]');
		return (element?.sheet?.cssRules[0] as CSSStyleRule).style;
	}

	function withPages(extra: Partial<HearthConfig>) {
		hearthConfig.set({
			...structuredClone(DEFAULT_HEARTH_CONFIG),
			theme: { accent: '#3366ff' },
			rooms: [
				{ id: 'home', name: 'Home', icon: 'home', cards: [[]] },
				{
					id: 'garden',
					name: 'Garden',
					icon: 'park',
					cards: [[]],
					theme: 'forest',
					background_image: IMAGE,
					background_scrim: 'strong'
				}
			],
			...extra
		});
	}

	it('wears the scheduled preset on a day inside its range', () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-12-24T12:00:00Z'));
		withPages({ theme_schedule: [{ theme: 'winter', from: '12-01', to: '02-28' }] });
		render(ThemeStyle, { pageId: 'home' });
		expect(themeRule().getPropertyValue('--h-bg-1')).toBe(presetTheme('winter').background_outer);
	});

	it('keeps the day theme outside the range', () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-07-01T12:00:00Z'));
		withPages({ theme_schedule: [{ theme: 'winter', from: '12-01', to: '02-28' }] });
		render(ThemeStyle, { pageId: 'home' });
		expect(themeRule().getPropertyValue('--h-accent-rgb')).toBe('51 102 255');
	});

	it('lays the page look over the theme and takes it back on leaving the page', async () => {
		withPages({});
		const view = render(ThemeStyle, { pageId: 'garden' });
		expect(themeRule().getPropertyValue('--h-bg-1')).toBe(presetTheme('forest').background_outer);
		expect(themeRule().getPropertyValue('--h-bg-image')).toContain('/_api/hearth_images/');
		expect(themeRule().getPropertyValue('--h-bg-scrim')).toBe(BACKGROUND_SCRIMS.strong);

		await view.rerender({ pageId: 'home' });
		expect(themeRule().getPropertyValue('--h-accent-rgb')).toBe('51 102 255');
		expect(themeRule().getPropertyValue('--h-bg-image')).toBe('none');
		expect(themeRule().getPropertyValue('--h-bg-scrim')).toBe('none');
		expect(themeRule().getPropertyValue('--h-bg-1')).toBe(THEME_DEFAULTS.background_outer);
	});

	it('fades into a page look unless motion is off', async () => {
		withPages({});
		const view = render(ThemeStyle, { pageId: 'home' });
		await view.rerender({ pageId: 'garden' });
		expect(document.documentElement.classList.contains('theme-fade')).toBe(true);
		await view.rerender({ pageId: 'home' });

		await act(() => motion.set(0));
		document.documentElement.classList.remove('theme-fade');
		await view.rerender({ pageId: 'garden' });
		expect(document.documentElement.classList.contains('theme-fade')).toBe(false);
	});

	it('does not fade when a page change leaves the tokens as they were', async () => {
		withPages({});
		const forest = { theme: presetTheme('forest') };
		const view = render(ThemeStyle, { pageId: 'home', presetOverride: forest });
		await view.rerender({ pageId: 'garden', presetOverride: forest });
		expect(document.documentElement.classList.contains('theme-fade')).toBe(false);
	});

	it('leaves the rule alone when states or the config change without changing the theme', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-12-24T12:00:00Z'));
		withPages({
			theme_schedule: [
				{ theme: 'holiday', when: [{ entity: 'input_boolean.party', state: 'on' }] },
				{ theme: 'winter', from: '12-01', to: '02-28' }
			]
		});
		states.set({ 'input_boolean.party': hassEntity('input_boolean.party', 'off') });
		render(ThemeStyle, { pageId: 'garden' });
		const setProperty = vi.spyOn(CSSStyleDeclaration.prototype, 'setProperty');
		try {
			await act(() =>
				states.update((current) => ({
					...current,
					'light.desk': hassEntity('light.desk', 'on')
				}))
			);
			await act(() => hearthConfig.update((config) => ({ ...config, padding_x: 4 })));
			expect(setProperty).not.toHaveBeenCalled();

			await act(() =>
				states.update((current) => ({
					...current,
					'input_boolean.party': hassEntity('input_boolean.party', 'on')
				}))
			);
			// the page theme still wins by day, so the holiday entry changes nothing either
			expect(setProperty).not.toHaveBeenCalled();

			await act(() =>
				hearthConfig.update((config) => ({
					...config,
					rooms: config.rooms.map((room) => ({ ...room, theme: undefined }))
				}))
			);
			expect(setProperty).toHaveBeenCalled();
			expect(themeRule().getPropertyValue('--h-bg-1')).toBe(
				presetTheme('holiday').background_outer
			);
		} finally {
			setProperty.mockRestore();
			states.set({} as never);
		}
	});
});
