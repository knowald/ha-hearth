import { describe, expect, it } from 'vitest';
import { countChanged } from './changes';

describe('countChanged', () => {
	it('counts the keys whose value differs, comparing nested values by content', () => {
		const before: Record<string, unknown> = { scale: 100, alerts: [{ id: 'a' }] };
		const after: Record<string, unknown> = {
			scale: 110,
			alerts: [{ id: 'a' }],
			rail_position: 'none'
		};
		expect(countChanged(['scale', 'alerts', 'rail_position'], before, after)).toBe(2);
	});

	it('ignores keys it was not given', () => {
		expect(countChanged<{ a?: number; b?: number }>(['a'], { a: 1, b: 1 }, { a: 1, b: 2 })).toBe(0);
	});
});
