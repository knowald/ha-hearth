import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { hearthConfigIssues, normalizeHearthConfig } from '../../normalize';
import { chartCard } from './chart';

function withCard(card: Record<string, unknown>) {
	return {
		version: 5,
		rail: [],
		rooms: [{ id: 'home', name: 'Home', cards: [[{ id: 'chart', type: 'chart', ...card }]] }]
	};
}

describe('chart card definition', () => {
	it('keeps a configured chart', () => {
		const config = normalizeHearthConfig(
			withCard({
				name: ' Temperature ',
				style: 'bar',
				period: 'week',
				height: 300,
				entities: [
					{ entity: ' sensor.living ', name: 'Living room', color: 'cool' },
					{ entity: 'sensor.bedroom' }
				]
			})
		);
		expect(config.rooms[0].cards[0][0]).toMatchObject({
			name: 'Temperature',
			style: 'bar',
			period: 'week',
			height: 300,
			entities: [
				{ entity: 'sensor.living', name: 'Living room', color: 'cool' },
				{ entity: 'sensor.bedroom', name: undefined, color: undefined }
			]
		});
	});

	it('coerces unusable values to unset and drops rows without an entity', () => {
		expect(
			chartCard.normalize({
				name: 4,
				style: 'pie',
				period: 'year',
				entities: [
					{ name: 'No entity' },
					'sensor.text',
					{ entity: '  ' },
					{ entity: 'sensor.a', color: 7 }
				]
			})
		).toEqual({
			name: undefined,
			style: undefined,
			period: undefined,
			entities: [{ entity: 'sensor.a', name: undefined, color: undefined }]
		});
		expect(chartCard.normalize({ entities: [] }).entities).toBeUndefined();
		expect(chartCard.normalize({ entities: 'sensor.a' }).entities).toBeUndefined();
	});

	it('keeps the first listing of an entity and drops the later ones', () => {
		expect(
			chartCard.normalize({
				entities: [
					{ entity: 'sensor.a', name: 'First' },
					{ entity: 'sensor.b' },
					{ entity: ' sensor.a ', name: 'Again' }
				]
			}).entities
		).toEqual([
			{ entity: 'sensor.a', name: 'First', color: undefined },
			{ entity: 'sensor.b', name: undefined, color: undefined }
		]);
	});

	it('draws at most six entities and reports more', () => {
		const entities = Array.from({ length: 8 }, (_, index) => ({ entity: `sensor.s${index}` }));
		expect(chartCard.normalize({ entities }).entities).toHaveLength(6);
		expect(hearthConfigIssues(withCard({ entities }))).toEqual([
			expect.stringContaining('must list at most 6 entities')
		]);
	});

	it('reports a style or period it does not know', () => {
		expect(v.safeParse(chartCard.schema, { style: 'line', period: 'month' }).success).toBe(true);
		expect(v.safeParse(chartCard.schema, { style: 'radial' }).success).toBe(false);
		expect(v.safeParse(chartCard.schema, { period: 'year' }).success).toBe(false);
		expect(v.safeParse(chartCard.schema, { entities: [{ name: 'x' }] }).success).toBe(false);
	});

	it('drafts a sensor, preferring a temperature', () => {
		expect(
			chartCard.draft?.({
				entityIds: ['light.desk', 'sensor.power', 'sensor.temperature'],
				pageName: 'Home'
			})
		).toEqual({ entities: [{ entity: 'sensor.temperature' }] });
		expect(chartCard.draft?.({ entityIds: ['sensor.power'], pageName: 'Home' })).toEqual({
			entities: [{ entity: 'sensor.power' }]
		});
		expect(chartCard.draft?.({ entityIds: ['light.desk'], pageName: 'Home' })).toBeUndefined();
	});

	it('needs an entity and lists every one', () => {
		expect(chartCard.needsConfiguration({ id: 'c', type: 'chart' })).toBe(true);
		expect(chartCard.needsConfiguration({ id: 'c', type: 'chart', entities: [] })).toBe(true);
		const card = {
			id: 'c',
			type: 'chart' as const,
			entities: [{ entity: 'sensor.a' }, { entity: 'sensor.b' }]
		};
		expect(chartCard.needsConfiguration(card)).toBe(false);
		expect(chartCard.entityIds(card)).toEqual(['sensor.a', 'sensor.b']);
	});
});
