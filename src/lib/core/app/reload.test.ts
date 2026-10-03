// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { holdReloads, requestReload } from './reload';

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
