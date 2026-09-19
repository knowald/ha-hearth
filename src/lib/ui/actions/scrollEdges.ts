import type { Action } from 'svelte/action';

export interface ScrollEdges {
	top: boolean;
	bottom: boolean;
	left: boolean;
	right: boolean;
}

interface ScrollEdgesOptions {
	/** Which edges currently have content past them. */
	report: (edges: ScrollEdges) => void;
}

const SLACK = 1;

/**
 * Whether each edge of a box has scrollable content beyond it. An element that
 * overflows visibly still reports a scrollHeight past its clientHeight, so the
 * axis is only measured when its computed overflow actually scrolls.
 */
export function edgesOf(node: HTMLElement, style: CSSStyleDeclaration): ScrollEdges {
	const scrolls = (overflow: string) => overflow === 'auto' || overflow === 'scroll';
	const vertical = scrolls(style.overflowY);
	const horizontal = scrolls(style.overflowX);
	return {
		top: vertical && node.scrollTop > SLACK,
		bottom: vertical && node.scrollTop + node.clientHeight < node.scrollHeight - SLACK,
		left: horizontal && node.scrollLeft > SLACK,
		right: horizontal && node.scrollLeft + node.clientWidth < node.scrollWidth - SLACK
	};
}

/**
 * Reports which edges of a scroll container have content past them, so an edge
 * treatment only paints where something is actually cut off. Measurements are
 * batched into a frame because scrolling fires far faster than it can matter.
 */
export const scrollEdges: Action<HTMLElement, ScrollEdgesOptions> = (node, options) => {
	let current = options;
	let frame: number | undefined;
	let last = '';

	function measure() {
		frame = undefined;
		const edges = edgesOf(node, getComputedStyle(node));
		const key = `${edges.top}${edges.bottom}${edges.left}${edges.right}`;
		if (key === last) return;
		last = key;
		current.report(edges);
	}

	function schedule() {
		if (frame === undefined) frame = requestAnimationFrame(measure);
	}

	const resize = new ResizeObserver(schedule);
	resize.observe(node);

	// content can grow without the box changing size, so the children are
	// watched too, and the watch list follows whatever is rendered into it
	function observeChildren() {
		for (const child of node.children) resize.observe(child);
		schedule();
	}
	const mutations = new MutationObserver(observeChildren);
	mutations.observe(node, { childList: true });
	observeChildren();

	node.addEventListener('scroll', schedule, { passive: true });

	return {
		update(next: ScrollEdgesOptions) {
			current = next;
		},
		destroy() {
			if (frame !== undefined) cancelAnimationFrame(frame);
			node.removeEventListener('scroll', schedule);
			resize.disconnect();
			mutations.disconnect();
		}
	};
};
