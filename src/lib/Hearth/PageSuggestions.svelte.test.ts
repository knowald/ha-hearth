import { render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Connection } from 'home-assistant-js-websocket';
import { connection } from '$lib/core/ha/connection';
import { states } from '$lib/core/ha/entities';
import { fetchRegistry } from '$lib/core/ha/registry';
import { hassEntity } from '$lib/core/ha/testing';
import { DEFAULT_HEARTH_CONFIG, type OverviewItem } from './config';
import PageSuggestions from './PageSuggestions.svelte';
import { hearthConfig, hearthEditMode } from './store';

vi.mock('$lib/core/ha/registry', () => ({ fetchRegistry: vi.fn() }));

function page(cards: OverviewItem[]) {
	hearthConfig.set({
		...structuredClone(DEFAULT_HEARTH_CONFIG),
		rooms: [{ id: 'living-room', name: 'Living room', icon: 'weekend', cards: [cards] }]
	});
}

describe('PageSuggestions', () => {
	beforeEach(() => {
		connection.set({} as Connection);
		hearthEditMode.set(true);
		vi.mocked(fetchRegistry).mockResolvedValue({
			floors: [],
			areas: [{ area_id: 'living', name: 'Living room' }],
			devices: [],
			entities: ['light.sofa', 'media_player.tv'].map((entity_id) => ({
				entity_id,
				area_id: 'living',
				device_id: null,
				disabled_by: null,
				hidden_by: null
			}))
		});
	});

	afterEach(() => {
		connection.set(undefined);
		hearthEditMode.set(false);
		states.set(undefined as never);
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
	});

	it('waits for the states, then offers the area cards', async () => {
		page([]);
		render(PageSuggestions, { roomId: 'living-room' });
		await vi.waitFor(() => expect(fetchRegistry).toHaveBeenCalled());
		expect(screen.queryByRole('region')).toBeNull();

		states.set({
			'light.sofa': hassEntity('light.sofa', 'on'),
			'media_player.tv': hassEntity('media_player.tv', 'off', { friendly_name: 'TV' })
		});
		expect(await screen.findByRole('button', { name: /Add TV/ })).toBeTruthy();
		expect(screen.getAllByRole('button')).toHaveLength(2);
	});

	it('leaves out a card whose entities a wildcard grid already shows', async () => {
		states.set({
			'light.sofa': hassEntity('light.sofa', 'on'),
			'media_player.tv': hassEntity('media_player.tv', 'off', { friendly_name: 'TV' })
		});
		page([{ id: 'all-lights', type: 'entities', wildcard: 'light.*', entities: [] }]);
		render(PageSuggestions, { roomId: 'living-room' });

		expect(await screen.findByRole('button', { name: /Add TV/ })).toBeTruthy();
		expect(screen.getAllByRole('button')).toHaveLength(1);
	});
});
