import Sortable from 'sortablejs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSortable, nestZoomedGhost, sortable, ZOOM_GHOST_SHELL } from './sortable';

function options(disabled: boolean) {
	return { group: 'test', items: [], disabled, onFinalize: () => {} };
}

describe('sortable loading', () => {
	afterEach(() => {
		document.body.replaceChildren();
	});

	it('leaves a disabled list alone until it is enabled', async () => {
		await loadSortable();
		const node = document.createElement('div');
		const action = sortable(node, options(true));
		await Promise.resolve();
		expect(Sortable.get(node)).toBeFalsy();

		action.update?.(options(false));
		await vi.waitFor(() => expect(Sortable.get(node)).toBeTruthy());
		expect(Sortable.get(node)!.options.disabled).toBe(false);

		action.update?.(options(true));
		expect(Sortable.get(node)!.options.disabled).toBe(true);
		action.destroy?.();
		expect(Sortable.get(node)).toBeFalsy();
	});

	it('creates nothing for a list destroyed while SortableJS loads', async () => {
		const node = document.createElement('div');
		const action = sortable(node, options(false));
		action.destroy?.();
		await loadSortable();
		await new Promise((resolve) => setTimeout(resolve));
		expect(Sortable.get(node)).toBeFalsy();
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
