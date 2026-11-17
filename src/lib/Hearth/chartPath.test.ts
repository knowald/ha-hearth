import { describe, expect, it } from 'vitest';
import { chartY, seriesPath } from './chartPath';

const box = { width: 100, height: 50, pad: 0 };

function indexed(values: (number | null)[]) {
	return values.map((y, x) => ({ x, y }));
}

describe('seriesPath', () => {
	it('draws one segment and closes its area to the bottom of the box', () => {
		const path = seriesPath(indexed([0, 10, 5]), box, { x: [0, 2], y: [0, 10] });
		expect(path.line).toBe('M0.0,50.0 L50.0,0.0 L100.0,25.0');
		expect(path.area).toBe('M0.0,50.0 L50.0,0.0 L100.0,25.0 L100,50 L0,50 Z');
		expect(path.coords).toEqual([
			{ x: 0, y: 50 },
			{ x: 50, y: 0 },
			{ x: 100, y: 25 }
		]);
	});

	it('starts a new segment after a gap', () => {
		const path = seriesPath(indexed([0, 10, null, 10, 0]), box, { x: [0, 4], y: [0, 10] });
		expect(path.line).toBe('M0.0,50.0 L25.0,0.0 M75.0,0.0 L100.0,50.0');
		expect(path.area).toBe(
			'M0.0,50.0 L25.0,0.0 L25,50 L0,50 Z M75.0,0.0 L100.0,50.0 L100,50 L75,50 Z'
		);
		expect(path.coords).toHaveLength(4);
	});

	it('skips leading and trailing nulls', () => {
		const path = seriesPath(indexed([null, 0, 10, null]), box, { x: [0, 3], y: [0, 10] });
		expect(path.line).toBe('M33.3,50.0 L66.7,0.0');
		expect(path.area).toBe('M33.3,50.0 L66.7,0.0 L66.7,50 L33.3,50 Z');
	});

	it('draws nothing when every value is missing', () => {
		expect(seriesPath(indexed([null, null]), box, { x: [0, 1], y: [0, 1] })).toEqual({
			line: '',
			area: '',
			coords: []
		});
	});

	it('places a single point without dividing by zero', () => {
		const path = seriesPath([{ x: 5, y: 3 }], box, { x: [5, 5], y: [3, 3] });
		expect(path.line).toBe('M0.0,50.0');
		expect(path.coords).toEqual([{ x: 0, y: 50 }]);
	});

	it('keeps a flat series on the bottom edge', () => {
		const path = seriesPath(indexed([4, 4, 4]), box, { x: [0, 2], y: [4, 4] });
		expect(path.line).toBe('M0.0,50.0 L50.0,50.0 L100.0,50.0');
	});

	it('places x by timestamp, not by index', () => {
		const start = Date.UTC(2026, 0, 1);
		const hour = 3600 * 1000;
		const points = [
			{ x: start, y: 1 },
			{ x: start + hour, y: 2 },
			{ x: start + 4 * hour, y: 1 }
		];
		const path = seriesPath(points, box, { x: [start, start + 4 * hour], y: [1, 2] });
		expect(path.coords.map((point) => point.x)).toEqual([0, 25, 100]);
	});

	it('insets the line by the padding at the top and bottom only', () => {
		const padded = { width: 100, height: 50, pad: 5 };
		const path = seriesPath(indexed([0, 10]), padded, { x: [0, 1], y: [0, 10] });
		expect(path.line).toBe('M0.0,45.0 L100.0,5.0');
		expect(path.area).toBe('M0.0,45.0 L100.0,5.0 L100,50 L0,50 Z');
		expect(chartY(5, padded, [0, 10])).toBe(25);
	});
});
