import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { hearthConfigIssues, normalizeHearthConfig } from '../../normalize';
import { todoCard } from './todo';

function withCard(card: Record<string, unknown>) {
	return {
		version: 5,
		rail: [],
		rooms: [{ id: 'kitchen', name: 'Kitchen', cards: [[{ id: 'list', ...card }]] }]
	};
}

describe('todo card definition', () => {
	it('keeps a configured list and drops defaults', () => {
		expect(
			todoCard.normalize({
				entity: ' todo.shopping ',
				title: 'Shopping',
				show_completed: true,
				sort: 'due',
				hide_add: true
			})
		).toEqual({
			entity: 'todo.shopping',
			title: 'Shopping',
			show_completed: true,
			sort: 'due',
			hide_add: true
		});
		expect(
			todoCard.normalize({ entity: 'todo.chores', sort: 'manual', show_completed: false })
		).toEqual({
			entity: 'todo.chores',
			title: undefined,
			show_completed: undefined,
			sort: undefined,
			hide_add: undefined
		});
	});

	it('refuses an entity outside the todo domain', () => {
		expect(todoCard.normalize({ entity: 'sensor.shopping' }).entity).toBeUndefined();
		expect(todoCard.needsConfiguration({ id: 'x', type: 'todo' })).toBe(true);
		expect(todoCard.entityIds({ id: 'x', type: 'todo', entity: 'todo.shopping' })).toEqual([
			'todo.shopping'
		]);
	});

	it('validates the YAML shape', () => {
		const valid = (card: Record<string, unknown>) =>
			v.safeParse(todoCard.schema, { id: 'x', type: 'todo', ...card }).success;
		expect(valid({ entity: 'todo.shopping', sort: 'manual', show_completed: true })).toBe(true);
		expect(valid({ entity: 'light.desk' })).toBe(false);
		expect(valid({ entity: 'todo.shopping', sort: 'newest' })).toBe(false);
		expect(valid({ entity: 'todo.shopping', hide_add: 'yes' })).toBe(false);
	});

	it('round-trips through the dashboard document', () => {
		const document = withCard({ type: 'todo', entity: 'todo.shopping', sort: 'alphabetical' });
		expect(hearthConfigIssues(document)).toEqual([]);
		const card = normalizeHearthConfig(document).rooms[0].cards[0][0];
		expect(card).toMatchObject({ type: 'todo', entity: 'todo.shopping', sort: 'alphabetical' });
		expect(hearthConfigIssues(withCard({ type: 'todo', entity: 'todo.x', sort: 1 }))).not.toEqual(
			[]
		);
	});
});
