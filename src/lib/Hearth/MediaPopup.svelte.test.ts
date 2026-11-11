import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callService, type Connection, type HassServices } from 'home-assistant-js-websocket';
import { connection, health, services } from '$lib/core/ha/connection';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import { setCommandGate } from '$lib/core/ha/commands';
import { tick } from 'svelte';
import MediaPopup from './MediaPopup.svelte';

vi.mock('home-assistant-js-websocket', async (importOriginal) => ({
	...(await importOriginal<typeof import('home-assistant-js-websocket')>()),
	callService: vi.fn()
}));

const PLAYER = 'media_player.kitchen';
const MASS_QUEUE = { mass_queue: { get_queue_items: {}, play_queue_item: {} } };

function maPlayer(contentId = 'x://1', attributes: Record<string, unknown> = {}) {
	states.set({
		[PLAYER]: hassEntity(PLAYER, 'playing', {
			friendly_name: 'Kitchen',
			media_title: 'One',
			media_content_id: contentId,
			mass_player_type: 'player',
			app_id: 'music_assistant',
			...attributes
		})
	});
}

function queueAnswer(...titles: string[]) {
	return {
		response: {
			[PLAYER]: titles.map((title, index) => ({
				queue_item_id: `id-${index + 1}`,
				media_title: title,
				media_artist: `Artist ${index + 1}`,
				media_content_id: `x://${index + 1}`
			}))
		}
	};
}

beforeEach(() => {
	connection.set({} as Connection);
	health.set('connected');
	services.set(MASS_QUEUE as unknown as HassServices);
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.clearAllMocks();
	setCommandGate(() => true);
	services.set(undefined as unknown as HassServices);
	connection.set(undefined as unknown as Connection);
	health.set('lost');
});

describe('MediaPopup queue', () => {
	it("lists a Music Assistant player's upcoming tracks and plays one on a tap", async () => {
		maPlayer('x://1');
		vi.mocked(callService).mockResolvedValueOnce(queueAnswer('One', 'Two', 'Three') as never);
		render(MediaPopup, { entity: PLAYER, name: 'Kitchen' });

		const next = await screen.findByRole('button', { name: /Two/ });
		expect(screen.getByRole('button', { name: /Three/ })).toBeTruthy();
		// the current track is not "up next"
		expect(screen.queryByRole('button', { name: /^One/ })).toBeNull();
		expect(next.textContent).toContain('Artist 2');

		vi.mocked(callService).mockResolvedValueOnce(undefined as never);
		await fireEvent.click(next);
		expect(callService).toHaveBeenLastCalledWith(
			{},
			'mass_queue',
			'play_queue_item',
			{ entity: PLAYER, queue_item_id: 'id-2' },
			undefined
		);
	});

	it('plays a queued track from the keyboard', async () => {
		maPlayer('x://1');
		vi.mocked(callService).mockResolvedValueOnce(queueAnswer('One', 'Two') as never);
		render(MediaPopup, { entity: PLAYER, name: 'Kitchen' });
		const next = await screen.findByRole('button', { name: /Two/ });
		vi.mocked(callService).mockResolvedValueOnce(undefined as never);
		await fireEvent.keyDown(next, { key: 'Enter' });
		expect(callService).toHaveBeenLastCalledWith(
			{},
			'mass_queue',
			'play_queue_item',
			{ entity: PLAYER, queue_item_id: 'id-2' },
			undefined
		);
	});

	it('asks again when the track changes', async () => {
		maPlayer('x://1');
		vi.mocked(callService).mockResolvedValueOnce(queueAnswer('One', 'Two', 'Three') as never);
		render(MediaPopup, { entity: PLAYER, name: 'Kitchen' });
		await screen.findByRole('button', { name: /Two/ });

		vi.mocked(callService).mockResolvedValueOnce(
			queueAnswer('One', 'Two', 'Three', 'Four') as never
		);
		maPlayer('x://2', { media_title: 'Two' });
		expect(await screen.findByRole('button', { name: /Four/ })).toBeTruthy();
		expect(
			vi.mocked(callService).mock.calls.filter((call) => call[2] === 'get_queue_items')
		).toHaveLength(2);
		expect(screen.queryByRole('button', { name: /Two/ })).toBeNull();
		expect(screen.getByRole('button', { name: /Three/ })).toBeTruthy();
	});

	it('never leaves the track that just started tappable as next while the refresh is in flight', async () => {
		maPlayer('x://1');
		vi.mocked(callService).mockResolvedValueOnce(queueAnswer('One', 'Two', 'Three') as never);
		render(MediaPopup, { entity: PLAYER, name: 'Kitchen' });
		await screen.findByRole('button', { name: /Two/ });

		// the refresh hangs until the test releases it
		let release: (value: unknown) => void = () => {};
		vi.mocked(callService).mockReturnValueOnce(
			new Promise((resolve) => (release = resolve)) as never
		);
		maPlayer('x://2', { media_title: 'Two' });
		await waitFor(() => expect(screen.queryByRole('button', { name: /Two/ })).toBeNull());
		expect(screen.getByRole('button', { name: /Three/ })).toBeTruthy();
		expect(screen.queryByText(/Loading queue/)).toBeNull();

		release(queueAnswer('One', 'Two', 'Three', 'Four'));
		expect(await screen.findByRole('button', { name: /Four/ })).toBeTruthy();
		expect(screen.queryByRole('button', { name: /Two/ })).toBeNull();
	});

	it('shows loading, not the old list, after a jump to a track that was not up next', async () => {
		maPlayer('x://1');
		vi.mocked(callService).mockResolvedValueOnce(queueAnswer('One', 'Two', 'Three') as never);
		render(MediaPopup, { entity: PLAYER, name: 'Kitchen' });
		await screen.findByRole('button', { name: /Two/ });

		vi.mocked(callService).mockReturnValueOnce(new Promise(() => {}) as never);
		maPlayer('x://9', { media_title: 'Elsewhere' });
		expect(await screen.findByText(/Loading queue/)).toBeTruthy();
		expect(screen.queryByRole('button', { name: /Two|Three/ })).toBeNull();
	});

	it('asks again only when the track changes, not on volume or position updates', async () => {
		maPlayer('x://1');
		vi.mocked(callService).mockResolvedValueOnce(queueAnswer('One', 'Two', 'Three') as never);
		render(MediaPopup, { entity: PLAYER, name: 'Kitchen' });
		await screen.findByRole('button', { name: /Two/ });
		const asked = () =>
			vi.mocked(callService).mock.calls.filter((call) => call[2] === 'get_queue_items').length;
		expect(asked()).toBe(1);

		// a volume drag, a position tick, shuffle: every update is a new attributes object
		for (const attributes of [
			{ volume_level: 0.2 },
			{ volume_level: 0.35 },
			{ media_position: 42 },
			{ shuffle: true }
		]) {
			maPlayer('x://1', attributes);
			await tick();
			expect(screen.queryByText(/Loading queue/)).toBeNull();
		}
		expect(asked()).toBe(1);
		expect(screen.getByRole('button', { name: /Two/ })).toBeTruthy();

		// a real track change still refreshes
		vi.mocked(callService).mockResolvedValueOnce(queueAnswer('One', 'Two', 'Three') as never);
		maPlayer('x://2', { media_title: 'Two' });
		await waitFor(() => expect(asked()).toBe(2));
	});

	it('offers Retry when the queue could not be read, and loads it from there', async () => {
		maPlayer('x://1');
		vi.mocked(callService).mockRejectedValueOnce(new Error('Service not found'));
		render(MediaPopup, { entity: PLAYER, name: 'Kitchen' });
		const retry = await screen.findByRole('button', { name: 'Retry' });

		vi.mocked(callService).mockResolvedValueOnce(queueAnswer('One', 'Two') as never);
		await fireEvent.click(retry);
		expect(await screen.findByRole('button', { name: /Two/ })).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
	});

	it('says the queue is empty after the last track', async () => {
		maPlayer('x://2');
		vi.mocked(callService).mockResolvedValueOnce(queueAnswer('One', 'Two') as never);
		render(MediaPopup, { entity: PLAYER, name: 'Kitchen' });
		expect(await screen.findByText('Queue is empty')).toBeTruthy();
	});

	it('keeps "not available" for a Music Assistant player without mass_queue, and asks nothing', async () => {
		services.set({} as HassServices);
		maPlayer('x://1');
		render(MediaPopup, { entity: PLAYER, name: 'Kitchen' });
		expect(screen.getByText('Queue not available for this player')).toBeTruthy();
		expect(callService).not.toHaveBeenCalled();
	});

	it('keeps "not available" for a player that is neither SpotifyPlus nor Music Assistant', () => {
		states.set({ [PLAYER]: hassEntity(PLAYER, 'playing', { friendly_name: 'Kitchen' }) });
		render(MediaPopup, { entity: PLAYER, name: 'Kitchen' });
		expect(screen.getByText('Queue not available for this player')).toBeTruthy();
		expect(callService).not.toHaveBeenCalled();
	});
});
