import { describe, expect, it } from 'vitest';
import { edgesOf, type ScrollEdges } from './scrollEdges';

function box(values: Partial<Record<keyof HTMLElement, number>>): HTMLElement {
	return {
		scrollTop: 0,
		scrollLeft: 0,
		clientHeight: 100,
		clientWidth: 100,
		scrollHeight: 100,
		scrollWidth: 100,
		...values
	} as unknown as HTMLElement;
}

const overflow = (overflowY: string, overflowX = 'visible') =>
	({ overflowY, overflowX }) as CSSStyleDeclaration;

const flat: ScrollEdges = { top: false, bottom: false, left: false, right: false };

describe('edgesOf', () => {
	it('sees content past the bottom of a scrolling box', () => {
		expect(edgesOf(box({ scrollHeight: 400 }), overflow('auto'))).toEqual({
			...flat,
			bottom: true
		});
	});

	it('sees both edges once the box is scrolled into the middle', () => {
		expect(edgesOf(box({ scrollHeight: 400, scrollTop: 150 }), overflow('scroll'))).toEqual({
			...flat,
			top: true,
			bottom: true
		});
	});

	it('drops the bottom edge at the end of the scroll', () => {
		expect(edgesOf(box({ scrollHeight: 400, scrollTop: 300 }), overflow('auto'))).toEqual({
			...flat,
			top: true
		});
	});

	/* an element that overflows visibly reports the same scrollHeight as one
	   that scrolls, and nothing is cut off there */
	it('reports nothing when the overflow is visible', () => {
		expect(edgesOf(box({ scrollHeight: 400 }), overflow('visible'))).toEqual(flat);
	});

	it('measures each axis against its own overflow', () => {
		expect(
			edgesOf(box({ scrollHeight: 400, scrollWidth: 400 }), overflow('visible', 'auto'))
		).toEqual({ ...flat, right: true });
	});

	it('ignores a sub-pixel remainder', () => {
		expect(edgesOf(box({ scrollHeight: 100.5 }), overflow('auto'))).toEqual(flat);
	});
});
