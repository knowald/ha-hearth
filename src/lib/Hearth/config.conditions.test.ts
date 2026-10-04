import { describe, expect, it } from 'vitest';
import { load } from 'js-yaml';
import { normalizeVisibility } from './config';
import { hearthConfigIssues, normalizeHearthConfig } from './normalize';
import { normalizeEntityRef, normalizeStyleRules } from './normalizers';
import { evaluateVisibility } from './visibility';

describe('device, time and attribute conditions in YAML', () => {
	it('keeps one device name or a list, and splits text the editor left with commas', () => {
		expect(normalizeVisibility([{ device: ' kitchen ' }])).toEqual([{ device: 'kitchen' }]);
		expect(normalizeVisibility([{ device: ['hall', ' ', 'kitchen'] }])).toEqual([
			{ device: ['hall', 'kitchen'] }
		]);
		expect(normalizeVisibility([{ device: 'hall, kitchen' }])).toEqual([
			{ device: ['hall', 'kitchen'] }
		]);
		expect(normalizeVisibility([{ device: '' }])).toBeUndefined();
	});

	it('puts weekdays in week order, whatever their case', () => {
		const [condition] = normalizeVisibility(
			load(`
- time:
    after: 22:00
    before: '6:30'
    weekdays: [Sun, FRI]
`)
		)!;
		expect(condition).toEqual({
			time: { after: '22:00', before: '6:30', weekdays: ['fri', 'sun'] }
		});
	});

	it('keeps a window it cannot read, so the item stays hidden instead of showing always', () => {
		const kept = normalizeVisibility([
			{ time: { after: '25:00' } },
			{ time: {} },
			{ time: { weekdays: ['fri', 'funday'] } }
		])!;
		expect(kept).toEqual([
			{ time: { after: '25:00' } },
			{ time: {} },
			{ time: { weekdays: ['fri', 'funday'] } }
		]);
		const friday = { now: new Date('2026-10-02T12:00:00') };
		for (const condition of kept)
			expect(evaluateVisibility([condition], {}, {}, friday)).toBe(false);
	});

	it('keeps the attribute on an entity condition', () => {
		expect(
			normalizeVisibility([
				{ entity: 'climate.living', attribute: ' hvac_action ', state: 'heating' }
			])
		).toEqual([{ entity: 'climate.living', attribute: 'hvac_action', state: 'heating' }]);
	});

	it('reports malformed conditions', () => {
		const issues = hearthConfigIssues({
			rail: [],
			rooms: [
				{
					id: 'home',
					cards: [[]],
					visibility: [{ time: { after: '7pm' } }, { device: [] }, { time: {} }]
				}
			]
		});
		expect(issues).toEqual([
			'rooms[0].visibility[0].time.after must be a time like 22:00',
			'rooms[0].visibility[1].device must name at least one device',
			'rooms[0].visibility[2].time needs after, before or weekdays'
		]);
		expect(
			hearthConfigIssues({
				rail: [],
				rooms: [{ id: 'home', cards: [[]], visibility: [{ time: { weekdays: ['sat'] } }] }]
			})
		).toEqual([]);
	});
});

describe('page visibility', () => {
	it('is kept on a page and dropped when nothing in it is usable', () => {
		const config = normalizeHearthConfig({
			rail: [],
			rooms: [
				{ id: 'home', cards: [[]] },
				{
					id: 'cameras',
					cards: [[]],
					visibility: [{ entity: 'binary_sensor.doorbell', state: 'on' }]
				},
				{ id: 'junk', cards: [[]], visibility: [{ nonsense: true }] }
			]
		});
		expect(config.rooms.map((room) => room.visibility)).toEqual([
			undefined,
			[{ entity: 'binary_sensor.doorbell', state: 'on' }],
			undefined
		]);
	});
});

describe('style rules', () => {
	it('keeps rules that restyle something under usable conditions', () => {
		expect(
			normalizeStyleRules([
				{
					conditions: [{ entity: 'lock.front', state: 'unlocked' }],
					color: ' bad ',
					icon: 'lock_open',
					class: 'alarm loud'
				},
				// nothing to restyle
				{ conditions: [{ entity: 'lock.front', state: 'locked' }] },
				// no usable condition
				{ conditions: [{ nonsense: true }], color: 'good' },
				{ conditions: [{ device: 'hall' }], class: 'not a ;class' },
				'scalar'
			])
		).toEqual([
			{
				conditions: [{ entity: 'lock.front', state: 'unlocked' }],
				color: 'bad',
				icon: 'lock_open',
				class: 'alarm loud'
			}
		]);
		expect(normalizeStyleRules([])).toBeUndefined();
		expect(normalizeStyleRules('red')).toBeUndefined();
	});

	it('drops only an unusable or reserved class, and media conditions', () => {
		const door = { entity: 'lock.front', state: 'unlocked' };
		expect(
			normalizeStyleRules([
				{ conditions: [door], color: 'bad', class: 'not a ;class' },
				{ conditions: [door], icon: 'lock_open', class: 'alarm styled' },
				{ conditions: [door, { media: '(max-width: 900px)' }], class: 'front' },
				{ conditions: [{ media: '(max-width: 900px)' }], class: 'phone' }
			])
		).toEqual([
			{ conditions: [door], color: 'bad' },
			{ conditions: [door], icon: 'lock_open' },
			{ conditions: [door], class: 'front' }
		]);
	});

	it('reports reserved classes and media conditions', () => {
		const issues = hearthConfigIssues({
			rail: [],
			rooms: [
				{
					id: 'home',
					cards: [
						[
							{
								id: 'locks',
								type: 'entities',
								entities: [
									{
										entity: 'lock.front',
										style: [{ conditions: [{ entity: 'lock.front' }], class: 'tile' }]
									},
									{
										entity: 'lock.back',
										style: [{ conditions: [{ media: '(max-width: 900px)' }], color: 'bad' }]
									}
								]
							}
						]
					]
				}
			]
		});
		expect(issues).toEqual([
			'rooms[0].cards[0][0].entities[0].style[0].class reuses a class name Hearth uses itself',
			'rooms[0].cards[0][0].entities[1].style[0].conditions cannot use media queries; style rules follow states, not the screen'
		]);
	});

	it('rides on entity references and is checked by the issue checker', () => {
		const ref = normalizeEntityRef({
			entity: 'lock.front',
			style: [{ conditions: [{ entity: 'lock.front', state: 'unlocked' }], color: 'bad' }]
		});
		expect(ref?.style).toEqual([
			{ conditions: [{ entity: 'lock.front', state: 'unlocked' }], color: 'bad' }
		]);
		const issues = hearthConfigIssues({
			rail: [],
			rooms: [
				{
					id: 'home',
					cards: [
						[
							{
								id: 'locks',
								type: 'entities',
								entities: [
									{ entity: 'lock.front', style: [{ conditions: [], color: 'bad' }] },
									{ entity: 'lock.back', style: [{ conditions: [{ device: 'hall' }] }] }
								]
							}
						]
					]
				}
			]
		});
		expect(issues).toEqual([
			'rooms[0].cards[0][0].entities[0].style[0].conditions must have at least one condition',
			'rooms[0].cards[0][0].entities[1].style[0] needs a color, an icon or a class'
		]);
	});
});
