import Sortable from 'sortablejs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nestZoomedGhost, sortable, ZOOM_GHOST_SHELL } from './sortable';

function mount(zoom: number) {
	const node = document.createElement('div');
	Object.defineProperty(node, 'currentCSSZoom', { configurable: true, value: zoom });
	document.body.append(node);
	const action = sortable(node, {
		group: 'test',
		items: [],
		animation: 150,
		onFinalize: () => {}
	});
	return { node, action, instance: Sortable.get(node)! };
}

describe('sortable animation under zoom', () => {
	afterEach(() => {
		document.body.replaceChildren();
	});

	it('keeps the configured animation at 100%', () => {
		const { instance, action } = mount(1);
		expect(instance.options.animation).toBe(150);
		action.destroy?.();
	});

	it('turns the animation off while the page is zoomed', () => {
		const { node, instance, action } = mount(1.5);
		expect(instance.options.animation).toBe(0);
		Object.defineProperty(node, 'currentCSSZoom', { configurable: true, value: 1 });
		expect(instance.options.animation).toBe(150);
		action.destroy?.();
	});

	it('still accepts option updates', () => {
		const { instance, action } = mount(1);
		action.update?.({ group: 'test', items: [], animation: 300, onFinalize: () => {} });
		expect(instance.options.animation).toBe(300);
		action.destroy?.();
	});
});

describe('sortable on touch screens', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		document.body.replaceChildren();
	});

	it('drives the drag itself under a coarse pointer, whatever the user agent says', () => {
		vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(pointer: coarse)' }));
		const { instance, action } = mount(1);
		expect(instance.options.forceFallback).toBe(true);
		action.destroy?.();
	});

	it('keeps native drag and drop for a mouse', () => {
		vi.stubGlobal('matchMedia', () => ({ matches: false }));
		const { instance, action } = mount(1);
		expect(instance.options.forceFallback).toBe(false);
		action.destroy?.();
	});
});

describe('nestZoomedGhost', () => {
	it('moves the content into a copy of the item inside a bare shell', () => {
		const item = document.createElement('button');
		item.className = 'nav-item active';
		item.style.color = 'red';
		item.innerHTML = '<span class="nav-name">Kitchen</span>';
		const ghost = item.cloneNode(true) as HTMLElement;
		ghost.classList.add('sortable-fallback', 'sortable-drag');
		ghost.style.cssText = 'position: fixed; top: 10px; width: 120px;';

		nestZoomedGhost(ghost, item);

		expect(ghost.className).toBe(`sortable-fallback ${ZOOM_GHOST_SHELL}`);
		expect(ghost.style.width).toBe('120px');
		expect(ghost.children).toHaveLength(1);
		const inner = ghost.firstElementChild as HTMLElement;
		expect(inner.tagName).toBe('BUTTON');
		expect([...inner.classList]).toEqual(['nav-item', 'active', 'sortable-drag']);
		expect(inner.style.cssText).toBe('color: red;');
		expect(inner.querySelector('.nav-name')?.textContent).toBe('Kitchen');
	});
});
