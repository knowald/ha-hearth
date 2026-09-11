import { describe, expect, it } from 'vitest';
import { CONFIG_VERSION, currentHearthConfig } from './format';

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
