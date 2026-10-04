import type { HassEntities, HassEntity } from 'home-assistant-js-websocket';
import { trimmedOrUndefined as text } from '../normalizers';

export interface NowPlaying {
	entityId: string;
	title: string;
	artist?: string;
	/** Album art, as Home Assistant's media proxy serves it. */
	picture?: string;
}

// a player catching up on the network is still playing as far as the screen goes
const PLAYING = new Set(['playing', 'buffering']);

function isPlaying(entity: HassEntity | undefined): entity is HassEntity {
	return entity !== undefined && PLAYING.has(entity.state);
}

function describe(entity: HassEntity): NowPlaying {
	const attributes = entity.attributes ?? {};
	return {
		entityId: entity.entity_id,
		title: text(attributes.media_title) ?? text(attributes.friendly_name) ?? entity.entity_id,
		artist: text(attributes.media_artist) ?? text(attributes.media_album_name),
		picture: text(attributes.entity_picture)
	};
}

/**
 * What plays on the configured media player, or on any playing one when none
 * is configured. Undefined while nothing plays, so the sleep screen shows its
 * fallback background. Without a configured player, `current` stays the pick
 * for as long as it keeps playing, so two players do not take turns.
 */
export function nowPlaying(
	$states: HassEntities | undefined,
	entityId: string | undefined,
	current?: string
): NowPlaying | undefined {
	if (!$states) return undefined;
	if (entityId) {
		const entity = $states[entityId];
		return isPlaying(entity) ? describe(entity) : undefined;
	}
	const kept = current ? $states[current] : undefined;
	if (isPlaying(kept)) return describe(kept);
	const playing = Object.values($states)
		.filter((entity) => entity.entity_id.startsWith('media_player.') && isPlaying(entity))
		// a player with art and a title makes the better screen; ids keep the pick stable
		.sort(
			(a, b) =>
				Number(Boolean(b.attributes?.entity_picture)) -
					Number(Boolean(a.attributes?.entity_picture)) ||
				Number(Boolean(b.attributes?.media_title)) - Number(Boolean(a.attributes?.media_title)) ||
				a.entity_id.localeCompare(b.entity_id)
		);
	return playing.length ? describe(playing[0]) : undefined;
}

function same(a: NowPlaying | undefined, b: NowPlaying | undefined): boolean {
	return (
		a?.entityId === b?.entityId &&
		a?.title === b?.title &&
		a?.artist === b?.artist &&
		a?.picture === b?.picture
	);
}

export interface NowPlayingHold {
	/** Takes the latest pick; an empty one only clears what shows after `holdMs`. */
	update(next: NowPlaying | undefined): void;
	/** Clears at once, as when the screen wakes. */
	reset(): void;
	stop(): void;
}

/**
 * Keeps the last track on screen for a moment after it stops, so a skip to
 * the next song, which passes through idle or paused, does not flash the
 * fallback background in between. Calls `onchange` only on a real change.
 */
export function holdNowPlaying(
	onchange: (playing: NowPlaying | undefined) => void,
	holdMs = 5000
): NowPlayingHold {
	let shown: NowPlaying | undefined;
	let timer: ReturnType<typeof setTimeout> | undefined;

	function show(next: NowPlaying | undefined) {
		clearTimeout(timer);
		timer = undefined;
		if (same(shown, next)) return;
		shown = next;
		onchange(next);
	}

	return {
		update(next) {
			if (next) show(next);
			else if (shown && !timer) timer = setTimeout(() => show(undefined), holdMs);
		},
		reset() {
			show(undefined);
		},
		stop() {
			clearTimeout(timer);
		}
	};
}
