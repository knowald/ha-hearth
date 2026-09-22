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
import { CHART_PERIODS } from './model/widgets/chart';

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
	hearth_corners_: RADIUS_SCALES.map((scale) => scale.value),
	hearth_last_: [...CHART_PERIODS]
};
const DYNAMIC_PREFIXES = ['hearth_domain_', ...Object.keys(DYNAMIC_KEYS)];
const DYNAMIC_NAMES = new Set(
	Object.entries(DYNAMIC_KEYS).flatMap(([prefix, values]) => values.map((value) => prefix + value))
);
// hearth_ after a slash is an API route such as /_api/hearth_themes, not a key
const KEY_NAME = /(?<![\w/])hearth_[a-z0-9_]+/g;

// words that are written in capitals in running text too
const CAPS_ALLOWED = new Set(['CSS', 'HTTP', 'HTTPS', 'IANA', 'OLED', 'URI', 'URL', 'YAML']);

function sources(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) return sources(path);
		return /\.(ts|svelte|js)$/.test(entry.name) && !/\.test\.ts$/.test(entry.name) ? [path] : [];
	});
}

const code = sources('src')
	.map((path) => readFileSync(path, 'utf-8'))
	.join('\n');

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
		const referenced = new Set(code.match(KEY_NAME));
		// domain captions fall back to the domain name, so any domain key may be used
		const unused = hearthKeys.filter(
			(key) => !referenced.has(key) && !DYNAMIC_NAMES.has(key) && !key.startsWith('hearth_domain_')
		);
		expect(unused).toEqual([]);
	});

	it('has every hearth key the source names', () => {
		const named = new Set(code.match(KEY_NAME));
		// a name ending in _ is the literal half of a key built at runtime
		const prefixes = [...named].filter((name) => name.endsWith('_'));
		expect(prefixes.filter((prefix) => !DYNAMIC_PREFIXES.includes(prefix))).toEqual([]);
		const missing = [...named].filter((name) => !name.endsWith('_') && !(name in english));
		expect(missing).toEqual([]);
	});

	it('has every plain key passed to $lang', () => {
		const passed = [...code.matchAll(/\$lang\(\s*'([a-z0-9_]+)'\s*\)/g)].map((match) => match[1]);
		expect([...new Set(passed)].filter((key) => !(key in english))).toEqual([]);
	});

	it('names every value a runtime-built key can take', () => {
		const missing = Object.entries(DYNAMIC_KEYS)
			.flatMap(([prefix, values]) => values.map((value) => prefix + value))
			.filter((key) => !(key in english));
		expect(missing).toEqual([]);
	});
});
