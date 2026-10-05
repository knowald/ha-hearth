import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DndOptions } from './sortable';

/*
 * The lazy side of the `sortable` action, with SortableJS swapped for a stub
 * whose chunk fails the first time it is fetched.
 */
const loads = vi.hoisted(() => ({ count: 0 }));
const instance = vi.hoisted(() => ({ update: vi.fn(), destroy: vi.fn() }));
const createSortable = vi.hoisted(() => vi.fn(() => instance));

vi.mock('./sortableInstance', () => {
	loads.count += 1;
	if (loads.count === 1) throw new Error('chunk failed to load');
	return { createSortable };
});

const { sortable } = await import('./sortable');

function options(disabled: boolean, items: string[] = []): DndOptions<string> {
	return { group: 'test', items, disabled, onFinalize: () => {} };
}

describe('sortable loading', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('tries again on the next update after a failed load, with the latest options', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const node = document.createElement('div');
		const action = sortable(node, options(false));
		await vi.waitFor(() => expect(warn).toHaveBeenCalled());
		expect(createSortable).not.toHaveBeenCalled();

		// a later update while the second load runs must reach the instance
		action.update?.(options(false, ['a']));
		action.update?.(options(false, ['a', 'b']));
		await vi.waitFor(() => expect(createSortable).toHaveBeenCalledOnce());
		expect(createSortable).toHaveBeenCalledWith(
			node,
			expect.objectContaining({ items: ['a', 'b'] })
		);

		action.update?.(options(true, ['a', 'b']));
		expect(instance.update).toHaveBeenCalledWith(expect.objectContaining({ disabled: true }));
		action.destroy?.();
		expect(instance.destroy).toHaveBeenCalled();
	});
});
