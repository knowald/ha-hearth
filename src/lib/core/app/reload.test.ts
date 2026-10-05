// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { holdReloads, onBeforeReload, reloadPage, requestReload } from './reload';

describe('requested reloads', () => {
	const reload = vi.fn();
	const setItem = vi.fn();

	beforeEach(() => {
		vi.stubGlobal('location', { reload });
		vi.stubGlobal('sessionStorage', { setItem });
	});

	afterEach(() => {
		holdReloads(false);
		reload.mockClear();
		setItem.mockClear();
		vi.unstubAllGlobals();
	});

	it('reloads at once when nothing holds it', () => {
		requestReload();
		expect(setItem).toHaveBeenCalledWith('event', 'refresh');
		expect(reload).toHaveBeenCalledOnce();
	});

	it('waits for the hold to end, then reloads once', () => {
		holdReloads(true);
		requestReload();
		requestReload();
		expect(reload).not.toHaveBeenCalled();
		holdReloads(false);
		expect(reload).toHaveBeenCalledOnce();
		holdReloads(false);
		expect(reload).toHaveBeenCalledOnce();
	});

	it('does nothing on release when no reload was asked for', () => {
		holdReloads(true);
		holdReloads(false);
		expect(reload).not.toHaveBeenCalled();
	});
});

describe('reloadPage', () => {
	const reload = vi.fn();

	beforeEach(() => vi.stubGlobal('location', { reload }));

	afterEach(() => {
		reload.mockClear();
		vi.unstubAllGlobals();
	});

	it('runs the hooks first and reloads at once when none waits', () => {
		const order: string[] = [];
		reload.mockImplementation(() => order.push('reload'));
		const remove = onBeforeReload(() => void order.push('hook'));
		void reloadPage();
		expect(order).toEqual(['hook', 'reload']);
		remove();
		void reloadPage();
		expect(order).toEqual(['hook', 'reload', 'reload']);
	});

	it('waits for a hook that returns a promise', async () => {
		let release = () => {};
		const remove = onBeforeReload(() => new Promise<void>((resolve) => (release = resolve)));
		const done = reloadPage();
		await Promise.resolve();
		expect(reload).not.toHaveBeenCalled();
		release();
		await done;
		expect(reload).toHaveBeenCalledOnce();
		remove();
	});
});
