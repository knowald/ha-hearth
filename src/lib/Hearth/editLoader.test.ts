import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSortable } from '$lib/ui/actions/sortable';
import { preloadEditMode } from './editLoader';

// the real chunks are a build concern; SortableJS stands in for all three
vi.mock('$lib/ui/actions/sortable', () => ({ loadSortable: vi.fn() }));
vi.mock('./shell/EditBar.svelte', () => ({ default: {} }));
vi.mock('./edit/EditorHost.svelte', () => ({ default: {} }));

describe('preloadEditMode', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('reports the edit code as loaded', async () => {
		vi.mocked(loadSortable).mockResolvedValue({} as Awaited<ReturnType<typeof loadSortable>>);
		await expect(preloadEditMode()).resolves.toBe(true);
	});

	it('reports a failed load', async () => {
		vi.mocked(loadSortable).mockRejectedValue(new Error('offline'));
		await expect(preloadEditMode()).resolves.toBe(false);
	});

	it('stops waiting on a stalled load and lets edit mode open', async () => {
		vi.useFakeTimers();
		vi.mocked(loadSortable).mockReturnValue(new Promise(() => {}));
		const preload = preloadEditMode(3000);
		let settled: boolean | undefined;
		void preload.then((loaded) => (settled = loaded));
		await vi.advanceTimersByTimeAsync(2900);
		expect(settled).toBeUndefined();
		await vi.advanceTimersByTimeAsync(200);
		expect(settled).toBe(true);
	});
});
