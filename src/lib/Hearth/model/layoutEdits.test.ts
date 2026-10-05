import { describe, expect, it } from 'vitest';
import { DEFAULT_HEARTH_CONFIG, takenCardIds, type HearthConfig } from '../config';
import {
	cardColumnIndex,
	duplicateOverviewItem,
	duplicateRailWidget,
	duplicateRoom,
	moveOverviewItem,
	removeStackWithCards,
	roomColumnCount,
	shiftItem
} from './layoutEdits';

function config(): HearthConfig {
	const next = structuredClone(DEFAULT_HEARTH_CONFIG);
	next.rail = [
		{ id: 'clock', type: 'clock' },
		{ id: 'weather', type: 'weather', entity: 'weather.home', side: 'right' }
	] as never;
	next.rooms = [
		{
			id: 'den',
			name: 'Den',
			icon: 'sofa',
			cards: [
				[
					{ id: 'entities', type: 'entities', title: 'Lights', entities: [] },
					{
						id: 'stack',
						kind: 'stack',
						direction: 'vertical',
						cards: [{ id: 'entities-2', type: 'entities', entities: [] }]
					}
				],
				[{ id: 'scenes', type: 'scenes', scenes: [] }]
			] as never
		},
		{ id: 'kitchen', name: 'Kitchen', icon: 'kitchen', columns: 2, cards: [] }
	];
	return next;
}

function unique(ids: string[]) {
	return new Set(ids).size === ids.length;
}

describe('duplicateOverviewItem', () => {
	it('inserts a copy after the card with an id no page uses yet', () => {
		const draft = config();
		const copyId = duplicateOverviewItem(draft, 'den', 'entities');
		const column = draft.rooms[0].cards[0];
		expect(column.map((item) => item.id)).toEqual(['entities', copyId, 'stack']);
		expect(copyId).toBe('entities-3');
		expect(column[1]).toMatchObject({ type: 'entities', title: 'Lights' });
		expect(unique(takenCardIds(draft))).toBe(true);
	});

	it('gives a copied stack and every card in it new ids', () => {
		const draft = config();
		const copyId = duplicateOverviewItem(draft, 'den', 'stack')!;
		const copy = draft.rooms[0].cards[0][2] as { id: string; cards: { id: string }[] };
		expect(copy.id).toBe(copyId);
		expect(copy.cards[0].id).not.toBe('entities-2');
		expect(unique(takenCardIds(draft))).toBe(true);
	});

	it('copies a card inside a stack within that stack', () => {
		const draft = config();
		duplicateOverviewItem(draft, 'den', 'entities-2');
		const stack = draft.rooms[0].cards[0][1] as { cards: unknown[] };
		expect(stack.cards).toHaveLength(2);
	});

	it('does nothing for an id that is not on the page', () => {
		const draft = config();
		expect(duplicateOverviewItem(draft, 'kitchen', 'entities')).toBeUndefined();
	});
});

describe('duplicateRailWidget', () => {
	it('puts the copy next to the original, on its side, with a fresh id', () => {
		const draft = config();
		expect(duplicateRailWidget(draft.rail, 1)).toBe(2);
		expect(draft.rail.map((widget) => widget.id)).toEqual(['clock', 'weather', 'weather-2']);
		expect(draft.rail[2]).toMatchObject({ type: 'weather', side: 'right' });
	});
});

describe('duplicateRoom', () => {
	it('copies the page after itself with its own page and card ids', () => {
		const draft = config();
		const copyId = duplicateRoom(draft, 'den', 'Den copy');
		expect(copyId).toBe('den-copy');
		expect(draft.rooms.map((room) => room.id)).toEqual(['den', 'den-copy', 'kitchen']);
		const copy = draft.rooms[1];
		expect(copy.name).toBe('Den copy');
		expect(copy.cards.flat()).toHaveLength(3);
		expect(unique(takenCardIds(draft))).toBe(true);
		// the original keeps its ids
		expect(draft.rooms[0].cards[0][0].id).toBe('entities');
	});

	it('picks a free page id when the name is taken', () => {
		const draft = config();
		expect(duplicateRoom(draft, 'den', 'Kitchen')).toBe('kitchen-2');
	});
});

describe('moveOverviewItem', () => {
	it('moves a card to the end of a column on another page', () => {
		const draft = config();
		expect(moveOverviewItem(draft, 'scenes', 'den', 'kitchen', 1)).toBe(true);
		expect(draft.rooms[0].cards[1]).toEqual([]);
		// the kitchen's columns are written on first use, two of them
		expect(draft.rooms[1].cards.map((column) => column.map((item) => item.id))).toEqual([
			[],
			['scenes']
		]);
	});

	it('takes a card out of its stack and lands past the last column in the last one', () => {
		const draft = config();
		moveOverviewItem(draft, 'entities-2', 'den', 'den', 7);
		// the stack held only that card, so it goes too
		expect(draft.rooms[0].cards[0].map((item) => item.id)).toEqual(['entities']);
		expect(draft.rooms[0].cards[1].map((item) => item.id)).toEqual(['scenes', 'entities-2']);
	});

	it('keeps a stack that still holds cards', () => {
		const draft = config();
		duplicateOverviewItem(draft, 'den', 'entities-2');
		moveOverviewItem(draft, 'entities-2', 'den', 'kitchen', 0);
		expect(draft.rooms[0].cards[0].map((item) => item.id)).toEqual(['entities', 'stack']);
	});

	it('reports a card it could not find', () => {
		expect(moveOverviewItem(config(), 'missing', 'den', 'kitchen', 0)).toBe(false);
	});
});

describe('removeStackWithCards', () => {
	it('drops the stack and the cards in it', () => {
		const draft = config();
		expect(removeStackWithCards(draft, 'den', 'stack')).toBe(true);
		expect(takenCardIds(draft)).toEqual(['entities', 'scenes']);
	});

	it('leaves a card alone', () => {
		const draft = config();
		expect(removeStackWithCards(draft, 'den', 'entities')).toBe(false);
		expect(draft.rooms[0].cards[0]).toHaveLength(2);
	});
});

describe('placement helpers', () => {
	it('shifts by several places and stops at either end', () => {
		const list = ['a', 'b', 'c', 'd'];
		shiftItem(list, 3, -2);
		expect(list).toEqual(['a', 'd', 'b', 'c']);
		shiftItem(list, 1, -5);
		expect(list).toEqual(['d', 'a', 'b', 'c']);
		shiftItem(list, 0, 9);
		expect(list).toEqual(['a', 'b', 'c', 'd']);
	});

	it('counts columns not written yet and finds a card inside a stack', () => {
		const draft = config();
		expect(roomColumnCount(draft.rooms[1])).toBe(2);
		expect(roomColumnCount({ cards: [] })).toBe(1);
		expect(cardColumnIndex(draft.rooms[0], 'entities-2')).toBe(0);
		expect(cardColumnIndex(draft.rooms[0], 'scenes')).toBe(1);
	});
});
