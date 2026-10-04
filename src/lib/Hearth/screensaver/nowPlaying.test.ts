import type { HassEntities } from 'home-assistant-js-websocket';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { holdNowPlaying, nowPlaying } from './nowPlaying';

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
	it('counts a buffering player as playing', () => {
		const states = player('media_player.radio', 'buffering', {
			media_title: 'News'
		}) as unknown as HassEntities;
		expect(nowPlaying(states, 'media_player.radio')?.title).toBe('News');
		expect(nowPlaying(states, undefined)?.title).toBe('News');
	});

	it('sticks with the player it picked while that one keeps playing', () => {
		expect(nowPlaying(STATES, undefined, 'media_player.bedroom')?.entityId).toBe(
			'media_player.bedroom'
		);
		expect(nowPlaying(STATES, undefined, 'media_player.kitchen')?.entityId).toBe(
			'media_player.living'
		);
	});
});

describe('holdNowPlaying', () => {
	const TRACK = { entityId: 'media_player.living', title: 'Blue in Green' };

	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('keeps the last track for a moment after it stops', () => {
		const onchange = vi.fn();
		const hold = holdNowPlaying(onchange, 5000);
		hold.update(TRACK);
		hold.update({ ...TRACK });
		expect(onchange).toHaveBeenCalledTimes(1);
		hold.update(undefined);
		vi.advanceTimersByTime(4999);
		expect(onchange).toHaveBeenCalledTimes(1);
		hold.update(TRACK);
		vi.advanceTimersByTime(10_000);
		expect(onchange).toHaveBeenCalledTimes(1);
		hold.update(undefined);
		vi.advanceTimersByTime(5000);
		expect(onchange).toHaveBeenLastCalledWith(undefined);
	});

	it('clears at once on reset and never after stop', () => {
		const onchange = vi.fn();
		const hold = holdNowPlaying(onchange, 5000);
		hold.update(TRACK);
		hold.reset();
		expect(onchange).toHaveBeenLastCalledWith(undefined);
		hold.update(TRACK);
		hold.update(undefined);
		hold.stop();
		vi.advanceTimersByTime(10_000);
		expect(onchange).toHaveBeenLastCalledWith(TRACK);
	});
});
