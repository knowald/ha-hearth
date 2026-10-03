import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../../../static/translations/en.json';
import type { EntityRef } from '../../types';
import type { EntitiesCard } from './descriptor';
import Editor from './Editor.svelte';

function renderEditor(entities: EntityRef[], style?: 'stat') {
	const onchange = vi.fn();
	render(Editor, {
		initial: { id: 'e', type: 'entities', entities, style } as EntitiesCard,
		onchange
	});
	return () => onchange.mock.lastCall?.[0].fields.entities as EntityRef[];
}

async function expandRow(entity: string) {
	await fireEvent.click(screen.getByRole('button', { name: new RegExp(entity) }));
}

describe('entities card editor tile highlight', () => {
	it('stores a trimmed highlight entity and the non-empty states', async () => {
		const lastEntities = renderEditor([{ entity: 'sensor.washer' }]);
		await expandRow('sensor.washer');
		await fireEvent.input(
			screen.getByLabelText(en.hearth_active_while_entity_optional, { exact: false }),
			{
				target: { value: '  sensor.washer_status ' }
			}
		);
		await fireEvent.input(screen.getByLabelText(en.hearth_active_states_optional), {
			target: { value: ' running , , spinning ,' }
		});
		expect(lastEntities()[0]).toMatchObject({
			active_entity: 'sensor.washer_status',
			active_states: ['running', 'spinning']
		});
	});

	it('clears both fields when emptied', async () => {
		const lastEntities = renderEditor([
			{ entity: 'sensor.washer', active_entity: 'sensor.status', active_states: ['running'] }
		]);
		await expandRow('sensor.washer');
		await fireEvent.input(
			screen.getByLabelText(en.hearth_active_while_entity_optional, { exact: false }),
			{
				target: { value: ' ' }
			}
		);
		await fireEvent.input(screen.getByLabelText(en.hearth_active_states_optional), {
			target: { value: ' , ' }
		});
		expect(lastEntities()[0].active_entity).toBeUndefined();
		expect(lastEntities()[0].active_states).toBeUndefined();
	});

	it('hides the fields and drops stale values for light tiles and stat boxes', async () => {
		const highlight = { active_entity: 'sensor.status', active_states: ['running'] };
		const lastEntities = renderEditor([
			{ entity: 'light.desk', ...highlight },
			{ entity: 'sensor.washer', display: 'stat', ...highlight }
		]);
		await expandRow('light.desk');
		await expandRow('sensor.washer');
		expect(screen.queryByLabelText(en.hearth_active_states_optional)).toBeNull();
		for (const ref of lastEntities()) {
			expect(ref.active_entity).toBeUndefined();
			expect(ref.active_states).toBeUndefined();
		}
	});

	it('hides the fields when the card style makes every entity a stat box', async () => {
		const lastEntities = renderEditor(
			[{ entity: 'sensor.washer', active_states: ['running'] }],
			'stat'
		);
		await expandRow('sensor.washer');
		expect(screen.queryByLabelText(en.hearth_active_states_optional)).toBeNull();
		expect(lastEntities()[0].active_states).toBeUndefined();
	});
});
