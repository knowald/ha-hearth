import { get } from 'svelte/store';
import type { HassEntities } from 'home-assistant-js-websocket';
import { afterEach, describe, expect, it } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { popup } from '../store';
import { openEntityDetail } from '.';

describe('openEntityDetail', () => {
	afterEach(() => popup.set(null));

	it('opens the media popup for a media player', () => {
		states.set({
			'media_player.kitchen': {
				entity_id: 'media_player.kitchen',
				state: 'playing',
				attributes: { friendly_name: 'Kitchen speaker' }
			}
		} as unknown as HassEntities);
		openEntityDetail('media_player.kitchen');
		expect(get(popup)).toEqual({
			kind: 'media',
			entity: 'media_player.kitchen',
			name: 'Kitchen speaker'
		});
	});

	it('keeps a read-only view on the generic sheet, whose domain popups are all controls', () => {
		openEntityDetail('light.desk', 'Desk', { readonly: true });
		expect(get(popup)).toEqual({
			kind: 'detail',
			entity: 'light.desk',
			name: 'Desk',
			readonly: true
		});
	});

	it('falls back to the generic detail sheet for other domains', () => {
		openEntityDetail('switch.pump', 'Pump');
		expect(get(popup)).toEqual({ kind: 'detail', entity: 'switch.pump', name: 'Pump' });
	});
});
