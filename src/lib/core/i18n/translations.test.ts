import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	RADIUS_SCALES,
	SURFACE_BLUR_SCALES,
	TEXT_CONTRAST_SCALES,
	TEXT_SHADOW_SCALES,
	THEME_PRESETS
} from '$lib/core/theme';

const english: Record<string, string> = JSON.parse(
	readFileSync('static/translations/en.json', 'utf-8')
);
const hearthKeys = Object.keys(english).filter((key) => key.startsWith('hearth_'));

// keys built at runtime from a value, e.g. `hearth_domain_${domain}`
const DYNAMIC_KEYS: Record<string, string[]> = {
	hearth_theme_preset_: THEME_PRESETS.map((preset) => preset.id),
	hearth_text_contrast_: TEXT_CONTRAST_SCALES.map((scale) => scale.value),
	hearth_text_shadow_: TEXT_SHADOW_SCALES.map((scale) => scale.value),
	hearth_glass_: SURFACE_BLUR_SCALES.map((scale) => scale.value),
	hearth_corners_: RADIUS_SCALES.map((scale) => scale.value)
};
const DYNAMIC_PREFIXES = ['hearth_domain_', ...Object.keys(DYNAMIC_KEYS)];

// words that are written in capitals in running text too
const CAPS_ALLOWED = new Set(['CSS', 'HTTP', 'HTTPS', 'IANA', 'OLED', 'URI', 'URL', 'YAML']);

function sources(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) return sources(path);
		return /\.(ts|svelte|js)$/.test(entry.name) && !/\.test\.ts$/.test(entry.name) ? [path] : [];
	});
}

describe('en.json', () => {
	it('uses ASCII punctuation', () => {
		const offending = Object.entries(english).filter(([, value]) => /[…–—‘’“”]/.test(value));
		expect(offending).toEqual([]);
	});

	it('stores hearth copy in sentence case, leaving capitals to CSS', () => {
		const offending = hearthKeys.filter((key) => {
			// environment variable names such as HASS_URL are not prose
			const prose = english[key].replace(/\b[A-Z]+(?:_[A-Z]+)+\b/g, '');
			const words = prose.match(/\p{L}{2,}/gu) ?? [];
			return words.some((word) => word === word.toUpperCase() && !CAPS_ALLOWED.has(word));
		});
		expect(offending).toEqual([]);
	});

	it('references every hearth key from the source', () => {
		const code = sources('src')
			.map((path) => readFileSync(path, 'utf-8'))
			.join('\n');
		const referenced = new Set(code.match(/\bhearth_[a-z0-9_]+\b/g));
		const unused = hearthKeys.filter(
			(key) => !referenced.has(key) && !DYNAMIC_PREFIXES.some((prefix) => key.startsWith(prefix))
		);
		expect(unused).toEqual([]);
	});

	it('names every theme preset and scale the theme sheet lists', () => {
		const missing = Object.entries(DYNAMIC_KEYS)
			.flatMap(([prefix, values]) => values.map((value) => prefix + value))
			.filter((key) => !(key in english));
		expect(missing).toEqual([]);
	});
});
