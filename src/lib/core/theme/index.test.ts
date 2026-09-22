import { describe, expect, it } from 'vitest';
import {
	deriveText,
	GLASS_THEME,
	isLightTheme,
	luminance,
	SURFACE_BLUR_SCALES,
	TEXT_CONTRAST_SCALES,
	textContrastOf,
	TEXT_SHADOW_SCALES,
	THEME_DEFAULTS,
	THEME_PRESETS,
	themeStyle,
	VOID_THEME,
	WARM_PAPER_THEME
} from './index';

describe('THEME_PRESETS', () => {
	it('lists each preset id once', () => {
		const ids = THEME_PRESETS.map((preset) => preset.id);
		expect(ids).toEqual([...new Set(ids)]);
	});

	it('exposes Void as a true-black dark theme', () => {
		const preset = THEME_PRESETS.find((entry) => entry.id === 'void');
		expect(preset).toMatchObject({ id: 'void', theme: VOID_THEME });
		expect(VOID_THEME.background_outer).toBe('#000000');
		expect(VOID_THEME.background_inner).toBe('#0a0a0a');
		expect(isLightTheme(VOID_THEME)).toBe(false);
		expect(VOID_THEME.track).toMatch(/255,\s*255,\s*255/);
		expect(themeStyle(VOID_THEME)).toContain('--h-bg-1: #000000;');
	});

	it('keeps Warm Paper as a light theme', () => {
		expect(isLightTheme(WARM_PAPER_THEME)).toBe(true);
	});

	it('gives Frosted Glass a blur and a scrim to sit under it', () => {
		const preset = THEME_PRESETS.find((entry) => entry.id === 'glass');
		expect(preset).toMatchObject({ id: 'glass', theme: GLASS_THEME });
		expect(GLASS_THEME.surface_blur).toContain('blur(');
		expect(GLASS_THEME.background_scrim).toContain('linear-gradient');
		const css = themeStyle(GLASS_THEME);
		expect(css).toContain('--h-surface-blur: blur(20px) saturate(140%);');
		expect(css).toContain('--h-bg-scrim: linear-gradient(');
	});
});

describe('surface blur', () => {
	it('stays off by default so surfaces cost nothing until a theme opts in', () => {
		expect(THEME_DEFAULTS.surface_blur).toBe('none');
		expect(THEME_DEFAULTS.background_scrim).toBe('none');
		expect(themeStyle(THEME_DEFAULTS)).toContain('--h-surface-blur: none;');
	});

	it('offers named steps that each map to a usable backdrop-filter', () => {
		expect(SURFACE_BLUR_SCALES[0]).toMatchObject({ value: 'none', blur: 'none' });
		for (const scale of SURFACE_BLUR_SCALES.slice(1)) {
			expect(scale.blur).toMatch(/^blur\(\d+px\)/);
		}
	});
});

describe('the text ladder', () => {
	const INK = '#ffffff';
	const BACKGROUND = '#14110e';

	it('leaves every existing theme where it was when no fade is given', () => {
		expect(deriveText(INK, BACKGROUND)).toEqual(deriveText(INK, BACKGROUND, false, 1));
		// a golden step for Calm Hearth's seed, so a change to the fade factors
		// cannot quietly move every preset's ladder
		expect(deriveText('#f7efe4', '#16110c').text_5).toBe('#8b847c');
	});

	it('keeps the whole ladder nearer the ink as the fade drops', () => {
		const normal = deriveText(INK, BACKGROUND, false, 1);
		const high = deriveText(INK, BACKGROUND, false, 0.35);
		for (const step of ['text_3', 'text_4', 'text_5', 'text_6', 'label', 'icon'] as const) {
			expect(luminance(high[step])).toBeGreaterThan(luminance(normal[step]));
		}
		// the ink itself is the top of the ladder and never fades
		expect(high.text_1).toBe(INK);
	});

	it('reads the default theme as the normal step', () => {
		// Calm Hearth hand-authors its ladder rather than deriving it, so this
		// also proves the hand-written values still sit where the scale says
		expect(textContrastOf(THEME_DEFAULTS)).toBe('normal');
	});

	it('clamps a fade that would push a step past the background', () => {
		const ladder = deriveText(INK, BACKGROUND, false, 99);
		expect(ladder.text_6).toBe(BACKGROUND);
	});

	it('reads back the contrast step a theme was built with', () => {
		for (const scale of TEXT_CONTRAST_SCALES) {
			const theme = {
				background_outer: BACKGROUND,
				...deriveText(INK, BACKGROUND, false, scale.fade)
			};
			expect(textContrastOf(theme)).toBe(scale.value);
		}
	});
});

describe('the text shadow', () => {
	it('is off by default, so flat themes are untouched', () => {
		expect(THEME_DEFAULTS.text_shadow).toBe('none');
		expect(TEXT_SHADOW_SCALES[0]).toMatchObject({ value: 'none', shadow: 'none' });
		expect(themeStyle(THEME_DEFAULTS)).toContain('--h-text-shadow: none;');
	});

	it('is on for Frosted Glass, which has a photo behind its text', () => {
		expect(GLASS_THEME.text_shadow).toContain('rgba(');
		expect(textContrastOf(GLASS_THEME)).toBe('max');
		expect(themeStyle(GLASS_THEME)).toContain('--h-text-shadow: 0 2px 12px rgba(0, 0, 0, 0.6);');
	});
});
