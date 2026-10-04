import { get } from 'svelte/store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { holdReloads } from '$lib/core/app/reload';
import { DEFAULT_HEARTH_CONFIG } from './config';
import {
	cancelEdit,
	enterEditMode,
	fetchServerRevision,
	guardUnload,
	hearthConfig,
	hearthEditMode,
	hearthNeedsSetup,
	reportSheetChanges,
	saveFailure,
	saveState,
	updateConfig
} from './store';

vi.mock('$lib/core/app/reload', () => ({ holdReloads: vi.fn(), requestReload: vi.fn() }));

function rename() {
	updateConfig((config) => {
		config.rooms[0].name = 'Renamed';
	});
}

describe('an edit session', () => {
	afterEach(() => {
		cancelEdit();
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
		vi.unstubAllGlobals();
	});

	it('starts and ends without the last session save failure', () => {
		enterEditMode();
		saveState.set('error');
		saveFailure.set('disk full');
		cancelEdit();
		expect(get(saveState)).toBe('idle');
		expect(get(saveFailure)).toBeNull();

		saveState.set('conflict');
		enterEditMode();
		expect(get(saveState)).toBe('idle');
	});

	it('keeps a failed save that is handed over, and cancels back to before it', () => {
		const before = { config: get(hearthConfig), needsSetup: true };
		rename();
		hearthNeedsSetup.set(false);
		saveState.set('error');
		enterEditMode(before);
		expect(get(saveState)).toBe('error');
		cancelEdit();
		expect(get(hearthConfig).rooms[0].name).toBe(DEFAULT_HEARTH_CONFIG.rooms[0].name);
		// the first-run offer comes back with the empty dashboard
		expect(get(hearthNeedsSetup)).toBe(true);
		hearthNeedsSetup.set(false);
	});

	it('holds reloads Home Assistant asks for until the session ends', () => {
		vi.mocked(holdReloads).mockClear();
		enterEditMode();
		expect(holdReloads).toHaveBeenLastCalledWith(true);
		cancelEdit();
		expect(holdReloads).toHaveBeenLastCalledWith(false);
		expect(get(hearthEditMode)).toBe(false);
	});

	it('asks the browser to confirm leaving only while edits are unsaved', () => {
		const event = () => new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
		enterEditMode();
		const clean = event();
		guardUnload(clean);
		expect(clean.defaultPrevented).toBe(false);
		rename();
		const edited = event();
		guardUnload(edited);
		expect(edited.defaultPrevented).toBe(true);
	});

	it('also asks while an open sheet holds changes Done has not applied', () => {
		const event = () => new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
		reportSheetChanges(true);
		const typed = event();
		guardUnload(typed);
		expect(typed.defaultPrevented).toBe(true);
		reportSheetChanges(false);
		const closed = event();
		guardUnload(closed);
		expect(closed.defaultPrevented).toBe(false);
	});
});

describe('fetchServerRevision', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('reads the revision from the versions endpoint, uncached', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ revision: 7 }) });
		vi.stubGlobal('fetch', fetchMock);
		expect(await fetchServerRevision()).toBe(7);
		expect(fetchMock).toHaveBeenCalledWith('/_api/hearth_versions', {
			cache: 'no-store',
			signal: expect.any(AbortSignal)
		});
	});

	it('cannot say when the request fails', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
		expect(await fetchServerRevision()).toBeUndefined();
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => null }));
		expect(await fetchServerRevision()).toBeUndefined();
	});
});
