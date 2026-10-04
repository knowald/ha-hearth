import type { HassEntities, HassEntity } from 'home-assistant-js-websocket';
import { trimmedOrUndefined as text } from '../normalizers';

export interface NowPlaying {
	entityId: string;
	title: string;
	artist?: string;
	/** Album art, as Home Assistant's media proxy serves it. */
	picture?: string;
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
 * fallback background.
 */
export function nowPlaying(
	$states: HassEntities | undefined,
	entityId: string | undefined
): NowPlaying | undefined {
	if (!$states) return undefined;
	if (entityId) {
		const entity = $states[entityId];
		return entity?.state === 'playing' ? describe(entity) : undefined;
	}
	const playing = Object.values($states)
		.filter((entity) => entity.entity_id.startsWith('media_player.') && entity.state === 'playing')
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
