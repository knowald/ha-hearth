import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callService, type Connection } from 'home-assistant-js-websocket';
import { connection, health } from '$lib/core/ha/connection';
import { fetchMassQueue, fetchMediaQueue, isMusicAssistant, trimQueueTo } from './media';

vi.mock('home-assistant-js-websocket', async (importOriginal) => ({
	...(await importOriginal<typeof import('home-assistant-js-websocket')>()),
	callService: vi.fn()
}));

const PLAYER = 'media_player.kitchen';

// the shape mass_queue answers with: keyed by entity, the current item unmarked
function item(id: string, title: string, contentId: string, artist = 'Artist') {
	return {
		queue_item_id: id,
		media_title: title,
		media_artist: artist,
		media_album_name: '',
		media_content_id: contentId,
		media_image: '',
		favorite: false
	};
}

function answer(items: unknown) {
	vi.mocked(callService).mockResolvedValueOnce({ response: { [PLAYER]: items } } as never);
}

beforeEach(() => {
	connection.set({} as Connection);
	health.set('connected');
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.clearAllMocks();
	connection.set(undefined as unknown as Connection);
	health.set('lost');
});

describe('isMusicAssistant', () => {
	it('tells a Music Assistant player by its player type, whatever it is playing', () => {
		expect(isMusicAssistant({ mass_player_type: 'player', app_id: 'tv' })).toBe(true);
		expect(isMusicAssistant({ mass_player_type: 'group' })).toBe(true);
		expect(isMusicAssistant({ app_id: 'music_assistant' })).toBe(false);
		expect(isMusicAssistant({ sp_user_id: 'x' })).toBe(false);
		expect(isMusicAssistant({})).toBe(false);
	});
});

describe('fetchMassQueue', () => {
	it('asks mass_queue for one item before the current one and the next twenty', async () => {
		answer([]);
		await fetchMassQueue(PLAYER, 'library://track/2');
		expect(callService).toHaveBeenCalledWith(
			{},
			'mass_queue',
			'get_queue_items',
			{ entity: PLAYER, limit_before: 1, limit_after: 20 },
			undefined,
			true
		);
	});

	it('starts after the current item when a previous one comes first', async () => {
		answer([
			item('a', 'The Boxer', 'library://track/524'),
			item('b', 'Circles Around Me', 'apple_music://track/712257490'),
			item('c', 'Transition', 'ai_radio://sound_effect/x', ''),
			item('d', 'Only One', 'library://track/3900')
		]);
		const tracks = await fetchMassQueue(PLAYER, 'apple_music://track/712257490');
		expect(tracks).toEqual([
			{ name: 'Transition', artist: '', duration: 0, uri: 'ai_radio://sound_effect/x', id: 'c' },
			{ name: 'Only One', artist: 'Artist', duration: 0, uri: 'library://track/3900', id: 'd' }
		]);
	});

	it('starts after the first item at the start of a queue, where nothing comes before', async () => {
		answer([item('a', 'One', 'x://1'), item('b', 'Two', 'x://2')]);
		expect((await fetchMassQueue(PLAYER, 'x://1'))?.map((track) => track.id)).toEqual(['b']);
	});

	it('takes the second match when the same track repeats around the current one', async () => {
		answer([item('a', 'Same', 'x://1'), item('b', 'Same', 'x://1'), item('c', 'Next', 'x://2')]);
		expect((await fetchMassQueue(PLAYER, 'x://1'))?.map((track) => track.id)).toEqual(['c']);
	});

	it('shows the whole answer rather than guess when the current item is not in it', async () => {
		answer([item('a', 'One', 'x://1'), item('b', 'Two', 'x://2')]);
		expect((await fetchMassQueue(PLAYER, 'x://9'))?.map((track) => track.id)).toEqual(['a', 'b']);
		for (const missing of [undefined, null, '', 42]) {
			answer([item('a', 'One', ''), item('b', 'Two', 'x://2')]);
			expect((await fetchMassQueue(PLAYER, missing))?.map((track) => track.id)).toEqual(['a', 'b']);
		}
	});

	it('is empty when the current item is the last one', async () => {
		answer([item('a', 'One', 'x://1'), item('b', 'Last', 'x://2')]);
		expect(await fetchMassQueue(PLAYER, 'x://2')).toEqual([]);
	});

	it('copes with loosely shaped items', async () => {
		answer([{ media_title: null, queue_item_id: 7 }, {}, null]);
		expect(await fetchMassQueue(PLAYER, 'x://1')).toEqual([
			{ name: '', artist: '', duration: 0, uri: '', id: undefined },
			{ name: '', artist: '', duration: 0, uri: '', id: undefined },
			{ name: '', artist: '', duration: 0, uri: '', id: undefined }
		]);
	});

	it('is null when the answer has no list for this player, or the call fails', async () => {
		vi.mocked(callService).mockResolvedValueOnce({
			response: { 'media_player.other': [] }
		} as never);
		expect(await fetchMassQueue(PLAYER, 'x://1')).toBeNull();
		vi.mocked(callService).mockResolvedValueOnce(undefined as never);
		expect(await fetchMassQueue(PLAYER, 'x://1')).toBeNull();
		answer('not a list');
		expect(await fetchMassQueue(PLAYER, 'x://1')).toBeNull();
		vi.mocked(callService).mockRejectedValueOnce(new Error('Service not found'));
		expect(await fetchMassQueue(PLAYER, 'x://1')).toBeNull();
		health.set('lost');
		expect(await fetchMassQueue(PLAYER, 'x://1')).toBeNull();
	});
});

describe('fetchMediaQueue', () => {
	it('still reads a SpotifyPlus queue from its wrapped result', async () => {
		vi.mocked(callService).mockResolvedValueOnce({
			response: {
				result: {
					queue: [
						{ name: 'So What', artists: [{ name: 'Miles Davis' }], duration_ms: 562000, uri: 's:1' }
					]
				}
			}
		} as never);
		expect(await fetchMediaQueue('media_player.spotifyplus_will')).toEqual([
			{ name: 'So What', artist: 'Miles Davis', duration: 562, uri: 's:1' }
		]);
	});
});

describe('trimQueueTo', () => {
	const rows = [
		{ name: 'Two', artist: '', duration: 0, uri: 'x://2', id: 'b' },
		{ name: 'Three', artist: '', duration: 0, uri: 'x://3', id: 'c' },
		{ name: 'Four', artist: '', duration: 0, uri: 'x://4', id: 'd' }
	];

	it('keeps only the rows after the new current track', () => {
		expect(trimQueueTo(rows, 'x://2')?.map((row) => row.id)).toEqual(['c', 'd']);
		expect(trimQueueTo(rows, 'x://3')?.map((row) => row.id)).toEqual(['d']);
	});

	it('is empty when the new track was the last row', () => {
		expect(trimQueueTo(rows, 'x://4')).toEqual([]);
	});

	it('shows loading rather than a stale list when the new track is not among the rows', () => {
		expect(trimQueueTo(rows, 'x://9')).toBeUndefined();
		for (const missing of [undefined, null, '', 7])
			expect(trimQueueTo(rows, missing)).toBeUndefined();
	});

	it('leaves nothing to trim when no list was shown', () => {
		expect(trimQueueTo(undefined, 'x://2')).toBeUndefined();
		expect(trimQueueTo(null, 'x://2')).toBeUndefined();
		expect(trimQueueTo([], 'x://2')).toBeUndefined();
	});

	it('trims at the first match when a track is queued twice', () => {
		const twice = [...rows, { name: 'Two again', artist: '', duration: 0, uri: 'x://2', id: 'e' }];
		expect(trimQueueTo(twice, 'x://2')?.map((row) => row.id)).toEqual(['c', 'd', 'e']);
	});
});
