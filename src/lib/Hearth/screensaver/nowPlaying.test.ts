import type { HassEntities } from 'home-assistant-js-websocket';
import { describe, expect, it } from 'vitest';
import { nowPlaying } from './nowPlaying';

function player(entityId: string, state: string, attributes: Record<string, unknown> = {}) {
	return { [entityId]: { entity_id: entityId, state, attributes } };
}

const STATES = {
	...player('media_player.kitchen', 'paused', { media_title: 'News' }),
	...player('media_player.bedroom', 'playing', { media_title: 'Rain sounds' }),
	...player('media_player.living', 'playing', {
		media_title: 'Blue in Green',
		media_artist: 'Miles Davis',
		entity_picture: '/api/media_player_proxy/media_player.living?token=1'
	}),
	...player('light.desk', 'on')
} as unknown as HassEntities;

describe('nowPlaying', () => {
	it('follows the configured player only while it plays', () => {
		expect(nowPlaying(STATES, 'media_player.living')).toEqual({
			entityId: 'media_player.living',
			title: 'Blue in Green',
			artist: 'Miles Davis',
			picture: '/api/media_player_proxy/media_player.living?token=1'
		});
		expect(nowPlaying(STATES, 'media_player.kitchen')).toBeUndefined();
		expect(nowPlaying(STATES, 'media_player.missing')).toBeUndefined();
	});

	it('picks any playing player when none is configured, preferring one with art', () => {
		expect(nowPlaying(STATES, undefined)?.entityId).toBe('media_player.living');
	});

	it('falls back to the album and the player name for a sparse track', () => {
		const states = player('media_player.radio', 'playing', {
			friendly_name: 'Radio',
			media_album_name: 'Morning show'
		}) as unknown as HassEntities;
		expect(nowPlaying(states, undefined)).toEqual({
			entityId: 'media_player.radio',
			title: 'Radio',
			artist: 'Morning show',
			picture: undefined
		});
	});

	it('is empty while nothing plays', () => {
		const states = player('media_player.kitchen', 'paused') as unknown as HassEntities;
		expect(nowPlaying(states, undefined)).toBeUndefined();
		expect(nowPlaying(undefined, undefined)).toBeUndefined();
	});
});
