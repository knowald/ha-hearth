import { describe, expect, it } from 'vitest';
import { hexToHsv, hsvToHex, hueHex, normalizeHex } from './color';

describe('normalizeHex', () => {
	it('expands shorthand, adds the hash and lowercases', () => {
		expect(normalizeHex('#ABC')).toBe('#aabbcc');
		expect(normalizeHex('f4c879')).toBe('#f4c879');
		expect(normalizeHex('  #F4C879  ')).toBe('#f4c879');
	});

	it('rejects anything that is not a hex colour', () => {
		for (const value of ['', '#12', '#12345', 'rebeccapurple', 'rgb(1,2,3)', '#12345g']) {
			expect(normalizeHex(value)).toBeNull();
		}
	});
});

describe('hexToHsv', () => {
	it('reads the primaries', () => {
		expect(hexToHsv('#ff0000')).toEqual({ h: 0, s: 1, v: 1 });
		expect(hexToHsv('#00ff00')).toEqual({ h: 120, s: 1, v: 1 });
		expect(hexToHsv('#0000ff')).toEqual({ h: 240, s: 1, v: 1 });
	});

	it('gives greys no saturation', () => {
		expect(hexToHsv('#000000')).toEqual({ h: 0, s: 0, v: 0 });
		expect(hexToHsv('#ffffff')).toEqual({ h: 0, s: 0, v: 1 });
	});
});

describe('hsvToHex', () => {
	it('wraps the hue rather than clipping it', () => {
		expect(hsvToHex({ h: 360, s: 1, v: 1 })).toBe('#ff0000');
		expect(hsvToHex({ h: -120, s: 1, v: 1 })).toBe('#0000ff');
	});

	it('clamps saturation and value into range', () => {
		expect(hsvToHex({ h: 200, s: 5, v: 5 })).toBe(hsvToHex({ h: 200, s: 1, v: 1 }));
		expect(hsvToHex({ h: 200, s: -1, v: -1 })).toBe('#000000');
	});

	it('round-trips the theme swatches', () => {
		for (const hex of ['#f4c879', '#f0925f', '#e0788a', '#b39ddb', '#9fc7d8', '#a6cdb2']) {
			expect(hsvToHex(hexToHsv(hex))).toBe(hex);
		}
	});
});

describe('hueHex', () => {
	it('returns the fully saturated colour of a hue', () => {
		expect(hueHex(0)).toBe('#ff0000');
		expect(hueHex(180)).toBe('#00ffff');
	});
});
