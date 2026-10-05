import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_HEARTH_CONFIG, type HearthConfig } from './config';
import { applying, applyNow } from './applyNow';
import {
	cancelEdit,
	cancelRequestedAction,
	dismissConfirmation,
	hasUnsavedEdits,
	hearthConfig,
	hearthEditMode,
	hearthRevision,
	requestedConfirmation,
	saveState
} from './store';

/** Names the page, so each change is told apart in what was sent. */
const rename = (name: string) => (config: HearthConfig) => {
	config.rooms[0].name = name;
};

interface SaveReply {
	status: number;
	revision?: number;
}

let serverRevision = 1;
let saves: {
	body: { config: HearthConfig; revision: number };
	reply: (value: SaveReply) => void;
}[];

function respond({ status, revision }: SaveReply) {
	return {
		ok: status < 400,
		status,
		json: async () => ({ revision }),
		text: async () => (status >= 400 ? 'disk full' : '')
	};
}

beforeEach(() => {
	serverRevision = 1;
	saves = [];
	hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
	hearthRevision.set(1);
	vi.spyOn(console, 'error').mockImplementation(() => {});
	vi.stubGlobal(
		'fetch',
		vi.fn((url: string, init?: RequestInit) => {
			if (url.endsWith('/_api/hearth_versions')) {
				return Promise.resolve(respond({ status: 200, revision: serverRevision }));
			}
			// each save waits until the test answers it
			return new Promise((resolve) =>
				saves.push({
					body: JSON.parse(String(init?.body)),
					reply: (value) => resolve(respond(value))
				})
			);
		})
	);
});

afterEach(() => {
	cancelEdit();
	dismissConfirmation();
	hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('applyNow outside edit mode', () => {
	it('saves a second change made while the first is still saving', async () => {
		const first = applyNow(rename('A'));
		const second = applyNow(rename('B'));
		expect(get(applying)).toBe(true);

		await vi.waitFor(() => expect(saves).toHaveLength(1));
		expect(saves[0].body.config.rooms[0].name).toBe('A');
		saves[0].reply({ status: 200, revision: 2 });
		expect(await first).toBe('applied');

		await vi.waitFor(() => expect(saves).toHaveLength(2));
		expect(saves[1].body.revision).toBe(2);
		expect(saves[1].body.config.rooms[0].name).toBe('B');
		saves[1].reply({ status: 200, revision: 3 });

		expect(await second).toBe('applied');
		expect(get(saveState)).toBe('saved');
		expect(hasUnsavedEdits()).toBe(false);
		expect(get(hearthEditMode)).toBe(false);
		expect(get(applying)).toBe(false);
	});

	it('saves again when the dashboard changed while its save was out', async () => {
		const done = applyNow(rename('A'));
		await vi.waitFor(() => expect(saves).toHaveLength(1));
		hearthConfig.update((config) => ({ ...config, rooms: [{ ...config.rooms[0], name: 'C' }] }));
		saves[0].reply({ status: 200, revision: 2 });

		await vi.waitFor(() => expect(saves).toHaveLength(2));
		expect(saves[1].body.config.rooms[0].name).toBe('C');
		saves[1].reply({ status: 200, revision: 3 });
		expect(await done).toBe('applied');
		expect(hasUnsavedEdits()).toBe(false);
	});

	it.each([
		[409, 'conflict'],
		[500, 'error']
	])('hands a change whose save answers %i to edit mode', async (status, state) => {
		const done = applyNow(rename('A'));
		await vi.waitFor(() => expect(saves).toHaveLength(1));
		saves[0].reply({ status });

		expect(await done).toBe('unsaved');
		expect(get(saveState)).toBe(state);
		expect(get(hearthEditMode)).toBe(true);
		expect(get(hearthConfig).rooms[0].name).toBe('A');
		// Cancel returns to the dashboard from before the change
		cancelEdit();
		expect(get(hearthConfig).rooms[0].name).toBe(DEFAULT_HEARTH_CONFIG.rooms[0].name);
	});

	it('offers a reload first when another screen saved a newer revision', async () => {
		serverRevision = 5;
		const done = applyNow(rename('A'));
		await vi.waitFor(() => expect(get(requestedConfirmation)).not.toBeNull());
		expect(get(hearthConfig).rooms[0].name).not.toBe('A');

		cancelRequestedAction();
		await vi.waitFor(() => expect(saves).toHaveLength(1));
		saves[0].reply({ status: 200, revision: 6 });
		expect(await done).toBe('applied');
	});

	it('applies nothing when the reload offer is dismissed', async () => {
		serverRevision = 5;
		const done = applyNow(rename('A'));
		await vi.waitFor(() => expect(get(requestedConfirmation)).not.toBeNull());

		dismissConfirmation();
		expect(await done).toBe('declined');
		expect(get(hearthConfig).rooms[0].name).not.toBe('A');
		expect(saves).toHaveLength(0);
	});
});

describe('applyNow in edit mode', () => {
	it('adds the change to the draft without saving', async () => {
		hearthEditMode.set(true);
		expect(await applyNow(rename('A'))).toBe('applied');
		expect(get(hearthConfig).rooms[0].name).toBe('A');
		expect(saves).toHaveLength(0);
		hearthEditMode.set(false);
	});
});
