import { afterEach, describe, expect, it, vi } from 'vitest';
import { finePointer } from '$lib/core/app/pointer';
import { autofocus } from './autofocus';

function input() {
	const node = document.createElement('input');
	document.body.append(node);
	return node;
}

describe('autofocus', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		document.body.replaceChildren();
	});

	it('focuses the node under a fine pointer', () => {
		vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(pointer: fine)' }));
		const node = input();
		autofocus(node);
		expect(finePointer()).toBe(true);
		expect(document.activeElement).toBe(node);
	});

	it('leaves focus alone on a touch screen, where it would raise the keyboard', () => {
		vi.stubGlobal('matchMedia', () => ({ matches: false }));
		const node = input();
		autofocus(node);
		expect(finePointer()).toBe(false);
		expect(document.activeElement).not.toBe(node);
	});

	it('treats a browser without media queries as a touch screen', () => {
		vi.stubGlobal('matchMedia', undefined);
		expect(finePointer()).toBe(false);
	});
});
