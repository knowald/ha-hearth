import { describe, expect, it } from 'vitest';
import { CONFIG_VERSION, currentHearthConfig, formatReading, stepDecimals } from './format';

describe('Hearth document format', () => {
	it('accepts current documents and unstamped editor drafts', () => {
		const config = { version: CONFIG_VERSION, rail: [], rooms: [] };
		expect(currentHearthConfig(config)).toBe(config);
		expect(currentHearthConfig({ rail: [], rooms: [] })).toEqual({ rail: [], rooms: [] });
	});
	it.each([0, 1, 4, 6, '5', 5.5, null])('rejects unsupported version %s', (version) => {
		expect(() => currentHearthConfig({ version })).toThrow('Unsupported Hearth configuration');
	});
});

describe('formatReading', () => {
	it.each([
		[21, '', '21'],
		[21.04, '', '21'],
		[21.46, '', '21.5'],
		[-0.25, '', '-0.2'],
		[21.5, '°C', '21.5°C'],
		[20, '°', '20°'],
		[41.44, '%', '41.4%'],
		[3.25, 'kWh', '3.3 kWh'],
		[null, '°C', '-'],
		[undefined, '', '-'],
		[Number.NaN, '', '-']
	])('formats %s %s as %s', (value, unit, expected) => {
		expect(formatReading(value, unit)).toBe(expected);
	});
});

describe('stepDecimals', () => {
	it('keeps at least one decimal and as many as the step has', () => {
		expect(stepDecimals(1)).toBe(1);
		expect(stepDecimals(0.5)).toBe(1);
		expect(stepDecimals(0.05)).toBe(2);
		expect(formatReading(0.25, '', stepDecimals(0.05))).toBe('0.25');
	});
});
