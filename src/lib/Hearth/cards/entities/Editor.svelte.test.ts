import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
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

describe('entities card editor rows', () => {
	it('says an empty row is dropped on save, and drops it', async () => {
		const lastEntities = renderEditor([{ entity: 'light.desk' }]);
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_add_entity }));
		expect(screen.getAllByText(en.hearth_empty_row_removed).length).toBeGreaterThan(0);
		expect(lastEntities()).toEqual([expect.objectContaining({ entity: 'light.desk' })]);
	});

	it('appends several picked entities in the order they were picked', async () => {
		states.set({
			'light.desk': hassEntity('light.desk', 'on', { friendly_name: 'Desk lamp' }),
			'light.shelf': hassEntity('light.shelf', 'off', { friendly_name: 'Shelf light' }),
			'switch.fan': hassEntity('switch.fan', 'on', { friendly_name: 'Fan' })
		});
		const lastEntities = renderEditor([{ entity: 'light.desk' }]);
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_pick_several_entities }));
		await fireEvent.click(screen.getByRole('option', { name: /Fan/ }));
		await fireEvent.click(screen.getByRole('option', { name: /Shelf light/ }));
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_add_picked_entities }));
		expect(screen.queryByRole('dialog', { name: en.hearth_choose_entity })).toBeNull();
		expect(lastEntities().map((ref) => ref.entity)).toEqual([
			'light.desk',
			'switch.fan',
			'light.shelf'
		]);
	});
});
