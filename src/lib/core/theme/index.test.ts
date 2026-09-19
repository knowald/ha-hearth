import { describe, expect, it } from 'vitest';
import { isLightTheme, THEME_PRESETS, themeStyle, VOID_THEME, WARM_PAPER_THEME } from './index';

describe('THEME_PRESETS', () => {
	it('lists each preset id once', () => {
		const ids = THEME_PRESETS.map((preset) => preset.id);
		expect(ids).toEqual([...new Set(ids)]);
	});

	it('exposes Void as a true-black dark theme', () => {
		const preset = THEME_PRESETS.find((entry) => entry.id === 'void');
		expect(preset).toMatchObject({ id: 'void', name: 'Void (OLED)', theme: VOID_THEME });
		expect(VOID_THEME.background_outer).toBe('#000000');
		expect(VOID_THEME.background_inner).toBe('#0a0a0a');
		expect(isLightTheme(VOID_THEME)).toBe(false);
		expect(VOID_THEME.track).toMatch(/255,\s*255,\s*255/);
		expect(themeStyle(VOID_THEME)).toContain('--h-bg-1: #000000;');
	});

	it('keeps Warm Paper as a light theme', () => {
		expect(isLightTheme(WARM_PAPER_THEME)).toBe(true);
	});
});
