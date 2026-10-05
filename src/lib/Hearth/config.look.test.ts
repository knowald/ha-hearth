import { describe, expect, it } from 'vitest';
import {
	cardSpan,
	hasSpans,
	isMonthDay,
	spanLayout,
	type OverviewCard,
	type OverviewItem
} from './config';
import { hearthConfigIssues, newThemeIssues, normalizeHearthConfig } from './normalize';

/*
 * Seasonal theme schedules, page looks and cards that span columns: the
 * config shapes and the span layout.
 */

const IMAGE = 'hearth-images/0123456789abcdef0123456789abcdef.webp';

function card(id: string, span?: OverviewCard['span']): OverviewCard {
	return { id, type: 'template', ...(span ? { span } : {}) } as OverviewCard;
}

function document(extra: Record<string, unknown> = {}, page: Record<string, unknown> = {}) {
	return {
		rail: [],
		rooms: [{ id: 'home', name: 'Home', icon: 'home', cards: [[]], ...page }],
		...extra
	};
}

describe('isMonthDay', () => {
	it.each(['01-01', '02-29', '12-31', '04-30'])('takes %s', (value) => {
		expect(isMonthDay(value)).toBe(true);
	});

	it.each(['1-1', '13-01', '00-10', '04-31', '02-30', '12/24', 1224, undefined])(
		'refuses %s',
		(value) => {
			expect(isMonthDay(value)).toBe(false);
		}
	);
});

describe('card spans', () => {
	it('covers the columns a span asks for, never more than the page has', () => {
		expect(cardSpan(card('a', 'full'), 3)).toBe(3);
		expect(cardSpan(card('a', 2), 3)).toBe(2);
		expect(cardSpan(card('a', 3), 2)).toBe(2);
		expect(cardSpan(card('a', 'full'), 1)).toBe(1);
		expect(cardSpan(card('a'), 3)).toBe(1);
		const stack: OverviewItem = { id: 's', kind: 'stack', direction: 'horizontal', cards: [] };
		expect(cardSpan(stack, 3)).toBe(1);
	});

	it('says whether a page needs the spanned layout', () => {
		expect(hasSpans([[card('a', 'full')], [card('b')]])).toBe(true);
		expect(hasSpans([[card('a', 'full')]])).toBe(false);
		expect(hasSpans([[card('a')], [card('b')]])).toBe(false);
	});
});

describe('spanLayout', () => {
	const cellIds = (layout: ReturnType<typeof spanLayout>) =>
		layout.cells.map((cell) =>
			cell.kind === 'run'
				? `run ${cell.column}@${cell.row}: ${cell.items.map((item) => item.id).join(',')}`
				: `span ${cell.card.id}@${cell.row} ${cell.start}/${cell.span}`
		);

	it('puts a full-width card under both columns, which resume below it', () => {
		const layout = spanLayout([
			[card('a'), card('wide', 'full'), card('b')],
			[card('c'), card('d')]
		]);
		expect(cellIds(layout)).toEqual([
			'run 0@1: a',
			'span wide@2 1/2',
			'run 0@3: b',
			'run 1@1: c,d'
		]);
		expect(layout.rows).toEqual(['run', 'span', 'run']);
	});

	it('gives each column its n-th spanning card in column order', () => {
		const layout = spanLayout([
			[card('a'), card('left', 'full'), card('b')],
			[card('c'), card('right', 'full'), card('d')]
		]);
		expect(cellIds(layout)).toEqual([
			'run 0@1: a',
			'span left@2 1/2',
			'run 0@4: b',
			'run 1@1: c',
			'span right@3 1/2',
			'run 1@4: d'
		]);
	});

	it('starts a partial span at its own column, moved left to fit', () => {
		const layout = spanLayout([[card('a', 2)], [card('b', 2)], [card('c', 2)]]);
		expect(cellIds(layout)).toEqual(['span a@1 1/2', 'span b@2 2/2', 'span c@3 2/2']);
	});

	it('leaves out a row with nothing in it', () => {
		const layout = spanLayout([[card('top', 'full'), card('a')], [card('b')]]);
		expect(cellIds(layout)).toEqual(['span top@2 1/2', 'run 0@3: a', 'run 1@1: b']);
	});

	it('lists the cells column by column, in stored order', () => {
		const layout = spanLayout([
			[card('a'), card('wide', 'full'), card('b')],
			[card('c'), card('d')]
		]);
		const reading = layout.cells.flatMap((cell) =>
			cell.kind === 'run' ? cell.items.map((item) => item.id) : [cell.card.id]
		);
		expect(reading).toEqual(['a', 'wide', 'b', 'c', 'd']);
	});
});

describe('span in the config', () => {
	it('keeps 2, 3 and full and drops anything else', () => {
		const raw = document(
			{},
			{
				columns: 2,
				cards: [[card('a', 'full'), { ...card('b'), span: 4 }], [card('c', 2)]]
			}
		);
		const [home] = normalizeHearthConfig(raw).rooms;
		expect((home.cards[0][0] as OverviewCard).span).toBe('full');
		expect((home.cards[0][1] as OverviewCard).span).toBeUndefined();
		expect((home.cards[1][0] as OverviewCard).span).toBe(2);
	});

	it('reports a span that is not 2, 3 or full', () => {
		const raw = document({}, { cards: [[{ ...card('b'), span: 'half' }]] });
		expect(hearthConfigIssues(raw)).toEqual(['rooms[0].cards[0][0].span must be 2, 3 or full']);
	});
});

describe('theme_schedule', () => {
	it('keeps entries with a theme and dates or conditions', () => {
		const schedule = normalizeHearthConfig(
			document({
				theme_schedule: [
					{ theme: ' winter ', from: '12-01', to: '02-28' },
					{ theme: { accent: '#f80' }, night: 'void', when: [{ entity: 'input_boolean.party' }] },
					{ theme: 'autumn', from: '09-23' },
					{ theme: 'spring' },
					{ from: '03-01', to: '05-31' },
					{ theme: 'holiday', when: [{ media: '(min-width: 1px)' }] }
				]
			})
		).theme_schedule;
		expect(schedule).toEqual([
			{ theme: 'winter', from: '12-01', to: '02-28' },
			{ theme: { accent: '#ff8800' }, night: 'void', when: [{ entity: 'input_boolean.party' }] }
		]);
	});

	it('reports entries the dashboard could not use', () => {
		expect(
			hearthConfigIssues(
				document({
					theme_schedule: [
						{ theme: 'winter', from: '12-01' },
						{ theme: 'spring' },
						{ theme: 'autumn', from: '09-31', to: '11-30' },
						{ theme: 'holiday', when: [{ media: '(min-width: 1px)' }] },
						{ theme: 3, from: '01-01', to: '01-02' }
					]
				})
			)
		).toEqual([
			'theme_schedule[0] needs both from and to',
			'theme_schedule[1] needs from and to, or when',
			'theme_schedule[2].from must be a day like 12-24',
			'theme_schedule[3].when cannot use media queries; the theme follows states and dates, not the screen',
			'theme_schedule[4].theme must be a preset id, a saved theme name or a mapping of tokens'
		]);
	});

	it('checks written-out tokens strictly on save, as the day theme', () => {
		const raw = document({
			theme_schedule: [{ theme: { accent: 'red' }, night: { text_1: 'red; x: y' }, when: [] }]
		});
		expect(newThemeIssues(raw)).toEqual([
			'theme_schedule[0].theme.accent must be a hex colour like #f0b860',
			'theme_schedule[0].night.text_1 must be one CSS value, without ;'
		]);
	});
});

describe('page look', () => {
	it('keeps a usable background, a scrim level and a theme name', () => {
		const [home] = normalizeHearthConfig(
			document({}, { background_image: ` ${IMAGE} `, background_scrim: 'strong', theme: 'forest' })
		).rooms;
		expect(home).toMatchObject({
			background_image: IMAGE,
			background_scrim: 'strong',
			theme: 'forest'
		});
	});

	it('drops a background that cannot stay inside its token and a scrim of none', () => {
		const [home] = normalizeHearthConfig(
			document({}, { background_image: 'a.jpg); color: red', background_scrim: 'none' })
		).rooms;
		expect(home.background_image).toBeUndefined();
		expect(home.background_scrim).toBeUndefined();
	});

	it('loads such a background without an issue but refuses it on save', () => {
		const raw = document({}, { background_image: 'a.jpg); color: red' });
		expect(hearthConfigIssues(raw)).toEqual([]);
		expect(newThemeIssues(raw)).toEqual([
			'rooms[0].background_image must be one CSS value, without ;'
		]);
		expect(hearthConfigIssues(document({}, { background_scrim: 'none' }))).toEqual([
			'rooms[0].background_scrim must be light, medium or strong'
		]);
	});
});
