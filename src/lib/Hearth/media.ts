import { get } from 'svelte/store';
import { services } from '$lib/core/ha/connection';
import { states } from '$lib/core/ha/entities';
import { callEntityService } from '$lib/core/ha/commands';
import { callServiceForResponse, callServiceForResult } from '$lib/core/ha/history';

export interface QueueTrack {
	name: string;
	artist: string;
	/** seconds; 0 when the source does not say */
	duration: number;
	uri: string;
	/** a Music Assistant queue item, which a tap can play */
	id?: string;
}

export interface MediaPlaylist {
	name: string;
	uri: string;
	image: string | null;
	trackCount: number | null;
}

/** Whether the entity is backed by the SpotifyPlus integration, which exposes
 * queue and playlist data through response-returning services. */
export function hasSpotifyPlus(attributes: Record<string, unknown>): boolean {
	return typeof attributes.sp_user_id === 'string';
}

/** A SpotifyPlus lookup; the integration answers with a loosely shaped mapping. */
function spotifyPlusCall(name: string, data: Record<string, unknown>): Promise<any> {
	return callServiceForResult('spotifyplus', name, data);
}

/** Whether the entity is a Music Assistant player. */
export function isMusicAssistant(attributes: Record<string, unknown>): boolean {
	return typeof attributes.mass_player_type === 'string';
}

/** How many tracks the queue panel asks for; it shows up to 20. */
const QUEUE_LIMIT = 20;

/** One item of mass_queue's answer; every field is read defensively. */
interface MassQueueItem {
	queue_item_id?: unknown;
	media_title?: unknown;
	media_artist?: unknown;
	media_content_id?: unknown;
}

/**
 * The tracks after the current one in a Music Assistant queue, through
 * mass_queue. Its answer does not mark the current item, so it is found by the
 * player's `media_content_id`, searched through the whole answer: with one item
 * asked for before it, the current item is usually the first or the second, but
 * mass_queue's index can lag Home Assistant's state by a track or more. At the
 * head of a queue the answer starts AT the current item (mass_queue clamps the
 * window to 0), and nothing tells that apart from a previous item, so the first
 * match is taken: [A, A, B] keeps the real next A. The cost is the reverse case,
 * the same track played twice in a row while on the second copy, which then
 * lists the current track as next. When nothing matches, the whole answer is
 * shown rather than guessing.
 * The answer is keyed by the entity asked about (mass_queue 0.10.3, also for a
 * synced group member); an answer with exactly one other key is read as ours.
 */
export async function fetchMassQueue(
	entityId: string,
	currentContentId: unknown
): Promise<QueueTrack[] | null> {
	try {
		const response = (await callServiceForResponse('mass_queue', 'get_queue_items', {
			entity: entityId,
			limit_before: 1,
			limit_after: QUEUE_LIMIT
		})) as Record<string, unknown> | null;
		const keys = response ? Object.keys(response) : [];
		const items = response?.[entityId] ?? (keys.length === 1 ? response?.[keys[0]] : undefined);
		if (!Array.isArray(items)) return null;
		const queue = items as (MassQueueItem | null | undefined)[];
		const current =
			typeof currentContentId === 'string' && currentContentId !== ''
				? queue.findIndex((item) => item?.media_content_id === currentContentId)
				: -1;
		return queue.slice(current + 1).map((item) => ({
			name: String(item?.media_title ?? ''),
			artist: String(item?.media_artist ?? ''),
			duration: 0,
			uri: String(item?.media_content_id ?? ''),
			id: typeof item?.queue_item_id === 'string' ? item.queue_item_id : undefined
		}));
	} catch (error) {
		console.error(error);
		return null;
	}
}

/**
 * What Up next can show the moment the track changes, before the refresh
 * lands: the rows after the new current track, or undefined (loading) when
 * that track isn't among them, so a stale row is never left to tap.
 */
export function trimQueueTo(
	tracks: QueueTrack[] | null | undefined,
	currentContentId: unknown
): QueueTrack[] | undefined {
	if (!Array.isArray(tracks) || typeof currentContentId !== 'string' || !currentContentId) {
		return undefined;
	}
	const current = tracks.findIndex((track) => track.uri === currentContentId);
	return current === -1 ? undefined : tracks.slice(current + 1);
}

export async function fetchMediaQueue(entityId: string): Promise<QueueTrack[] | null> {
	try {
		const result = await spotifyPlusCall('get_player_queue_info', { entity_id: entityId });
		if (!Array.isArray(result?.queue)) return null;

		return result.queue.map((track: any) => ({
			name: String(track?.name ?? ''),
			artist: Array.isArray(track?.artists)
				? track.artists

						.map((artist: any) => artist?.name)
						.filter(Boolean)
						.join(', ')
				: '',
			duration: Math.round((track?.duration_ms ?? 0) / 1000),
			uri: String(track?.uri ?? '')
		}));
	} catch (error) {
		console.error(error);
		return null;
	}
}

export async function fetchMediaPlaylists(entityId: string): Promise<MediaPlaylist[] | null> {
	try {
		const result = await spotifyPlusCall('get_playlist_favorites', {
			entity_id: entityId,
			limit_total: 50
		});
		if (!Array.isArray(result?.items)) return null;

		return result.items.map((playlist: any) => ({
			name: String(playlist?.name ?? ''),
			uri: String(playlist?.uri ?? ''),
			image: playlist?.image_url ?? null,
			trackCount: playlist?.tracks?.total ?? null
		}));
	} catch (error) {
		console.error(error);
		return null;
	}
}

export interface MediaShortcut {
	name: string;
	uri: string;
	image_url?: string;
}

export interface LibraryItem {
	name: string;
	sub: string;
	uri: string;
	image: string | null;
}

export type LibraryKind = 'albums' | 'tracks' | 'artists';

/**
 * The SpotifyPlus entity that pairs with a Spotify media player: itself when
 * it already is one, the same account's twin otherwise, any SpotifyPlus
 * entity as a last resort.
 */
export function spotifyPlusEntityFor(entityId: string): string | undefined {
	const $states = get(states) ?? {};
	if (entityId.startsWith('media_player.spotifyplus_')) return entityId;
	const candidate = `media_player.spotifyplus_${entityId.replace('media_player.spotify_', '')}`;
	if ($states[candidate]) return candidate;
	return Object.keys($states).find((id) => id.startsWith('media_player.spotifyplus_'));
}

/** The Spotify Connect device to play on: the active one, the preferred name, or the first usable. */
async function resolveSpotifyDevice(
	spEntity: string,
	defaultDevice?: string
): Promise<string | undefined> {
	const active = get(states)?.[spEntity]?.attributes?.sp_device_id;
	if (typeof active === 'string' && active) return active;
	const result = await spotifyPlusCall('get_spotify_connect_devices', { entity_id: spEntity });
	const items: any[] = Array.isArray(result?.Items) ? result.Items : [];
	if (!items.length) return undefined;
	const usable = items.filter(
		(device) => device.DeviceInfo?.IsAvailable !== false && device.IsInDeviceList
	);
	if (defaultDevice) {
		const match =
			usable.find((d) => d.Name === defaultDevice) ?? items.find((d) => d.Name === defaultDevice);
		if (match) return match.Id;
	}
	return usable[0]?.Id ?? items[0]?.Id;
}

/**
 * Starts a Spotify URI on a player: through SpotifyPlus with device
 * resolution when the integration is present, else media_player.play_media.
 */
export async function playSpotifyUri(entityId: string, uri: string, defaultDevice?: string) {
	const spEntity = spotifyPlusEntityFor(entityId);
	const isTrack = uri.startsWith('spotify:track:');
	if (spEntity && get(services)?.spotifyplus) {
		const deviceId = await resolveSpotifyDevice(spEntity, defaultDevice).catch(() => undefined);
		callEntityService(
			'spotifyplus',
			isTrack ? 'player_media_play_tracks' : 'player_media_play_context',
			spEntity,
			{
				...(isTrack ? { uris: uri } : { context_uri: uri }),
				delay: 0.5,
				...(deviceId ? { device_id: deviceId } : {})
			}
		);
		return;
	}
	callEntityService('media_player', 'play_media', entityId, {
		media_content_id: uri,
		media_content_type: 'spotify'
	});
}

/** The user's saved albums, tracks or followed artists from SpotifyPlus. */
/** null means the request failed; the popup offers a retry rather than a spinner. */
export async function fetchSpotifyLibrary(
	entityId: string,
	kind: LibraryKind
): Promise<LibraryItem[] | null> {
	const service =
		kind === 'albums'
			? 'get_album_favorites'
			: kind === 'tracks'
				? 'get_track_favorites'
				: 'get_artists_followed';
	try {
		const result = await spotifyPlusCall(service, { entity_id: entityId, limit_total: 50 });
		const raw = result?.items;
		const items: any[] = Array.isArray(raw)
			? raw
			: raw && typeof raw === 'object'
				? Object.values(raw)
				: [];
		return items.map((entry) => {
			const item = entry?.album ?? entry?.track ?? entry;
			const artists = Array.isArray(item?.artists)
				? item.artists
						.map((artist: any) => artist?.name)
						.filter(Boolean)
						.join(', ')
				: '';
			return {
				name: String(item?.name ?? ''),
				sub:
					artists || (typeof item?.followers?.total === 'number' ? `${item.followers.total}` : ''),
				uri: String(item?.uri ?? ''),
				image: item?.image_url ?? item?.images?.[0]?.url ?? item?.album?.images?.[0]?.url ?? null
			};
		});
	} catch (error) {
		console.error(error);
		return null;
	}
}
