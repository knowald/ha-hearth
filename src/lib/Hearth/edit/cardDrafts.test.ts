import { describe, expect, it } from 'vitest';
import type { OverviewCard } from '../types';
import { draftCard } from './cardDrafts';

const room = {
	name: 'Den',
	cards: [
		[
			{
				id: 'lamps',
				type: 'entities',
				entities: [{ entity: 'light.den' }]
			}
		] as OverviewCard[]
	]
};
const knownIds = [
	'switch.kettle',
	'light.porch',
	'light.den',
	'climate.hall',
	'scene.movie',
	'scene.bright',
	'sensor.den_temperature',
	'sensor.power',
	'media_player.tv'
];

describe('draftCard', () => {
	it('starts single-entity cards on the first entity of their domain', () => {
		expect(draftCard('climate', { room, suggestions: [], knownIds })).toMatchObject({
			type: 'climate',
			entity: 'climate.hall'
		});
		expect(draftCard('media', { room, suggestions: [], knownIds })).toMatchObject({
			entity: 'media_player.tv'
		});
		expect(draftCard('temperature', { room, suggestions: [], knownIds })).toMatchObject({
			entity: 'sensor.den_temperature'
		});
	});

	it('puts the page entities first, then the rest in id order', () => {
		const card = draftCard('entities', { room, suggestions: [], knownIds });
		expect(card).toMatchObject({
			entities: [{ entity: 'light.den' }, { entity: 'light.porch' }]
		});
	});

	it('takes the import card for the page area when it brings something new', () => {
		const suggestion = {
			id: 'den-climate',
			type: 'climate',
			entity: 'climate.den',
			title: 'Heating'
		} as OverviewCard;
		const card = draftCard('climate', { room, suggestions: [suggestion], knownIds });
		expect(card).toMatchObject({ entity: 'climate.den', title: 'Heating' });
		expect(card.id).toBe('');
	});

	it('skips an import card the page already shows', () => {
		const shown = {
			id: 'den-lights',
			type: 'entities',
			entities: [{ entity: 'light.den' }]
		} as OverviewCard;
		expect(draftCard('entities', { room, suggestions: [shown], knownIds })).toMatchObject({
			entities: [{ entity: 'light.den' }, { entity: 'light.porch' }]
		});
	});

	it('names a header after the page and leaves the rest bare', () => {
		expect(draftCard('header', { room, suggestions: [], knownIds })).toMatchObject({
			title: 'Den'
		});
		expect(draftCard('iframe', { room, suggestions: [], knownIds })).toMatchObject({
			type: 'iframe',
			url: undefined
		});
		const vacuum = draftCard('vacuum', { room, suggestions: [], knownIds });
		expect(vacuum.type).toBe('vacuum');
		expect('entity' in vacuum && vacuum.entity).toBeFalsy();
	});

	it('caps the scenes it starts with', () => {
		const many = Array.from({ length: 9 }, (_, index) => `scene.s${index}`);
		const card = draftCard('scenes', { room, suggestions: [], knownIds: many });
		expect(card.type === 'scenes' && card.scenes).toHaveLength(6);
	});
});
