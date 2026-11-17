import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { english as en } from '$lib/core/i18n/testing';
import type { ChartCard } from './descriptor';
import Editor from './Editor.svelte';

const card: ChartCard = {
	id: 'chart',
	type: 'chart',
	style: 'bar',
	entities: [
		{ entity: 'sensor.living', name: 'Living room', color: 'Cool' },
		{ entity: 'sensor.bedroom', color: 'orange' }
	]
};

function open(initial: ChartCard | undefined = card) {
	const onchange = vi.fn();
	render(Editor, { initial, onchange });
	const last = () =>
		onchange.mock.lastCall?.[0] as {
			fields: Partial<ChartCard>;
			valid?: boolean;
			reason?: string;
		};
	return { onchange, last };
}

const entityInputs = () => screen.getAllByLabelText(en.entity) as HTMLInputElement[];
const chips = (name: string) => screen.getAllByRole('button', { name, pressed: undefined });

describe('chart card editor', () => {
	it('seeds a row per entity with its color choice', () => {
		const { last } = open();
		expect(entityInputs().map((input) => input.value)).toEqual(['sensor.living', 'sensor.bedroom']);
		expect(chips(en.hearth_cool)[0].getAttribute('aria-pressed')).toBe('true');
		expect(chips(en.hearth_custom)[1].getAttribute('aria-pressed')).toBe('true');
		expect(last()).toMatchObject({
			valid: true,
			fields: {
				style: 'bar',
				entities: [
					{ entity: 'sensor.living', name: 'Living room', color: 'Cool' },
					{ entity: 'sensor.bedroom', color: 'orange' }
				]
			}
		});
	});

	it('starts a new chart with one required row and names the entity as the reason', () => {
		const { last } = open({ id: 'chart', type: 'chart' });
		expect(entityInputs()).toHaveLength(1);
		expect(entityInputs()[0].getAttribute('aria-required')).toBe('true');
		expect(chips(en.hearth_default)[0].getAttribute('aria-pressed')).toBe('true');
		expect(last()).toMatchObject({
			valid: false,
			reason: en.hearth_field_required.replace('{field}', en.entity)
		});
	});

	it('stores a row once it has an entity, the default color as no color', async () => {
		const { last } = open({ id: 'chart', type: 'chart' });
		await fireEvent.input(entityInputs()[0], { target: { value: 'sensor.power' } });
		expect(last()).toMatchObject({
			valid: true,
			fields: { entities: [{ entity: 'sensor.power' }] }
		});
		expect(last().fields.entities?.[0]).not.toHaveProperty('color');
	});

	it('adds rows up to six and leaves out rows without an entity', async () => {
		const { last } = open();
		const add = () => screen.getByRole('button', { name: en.hearth_add_entity });
		for (let count = 2; count < 6; count += 1) await fireEvent.click(add());
		expect(entityInputs()).toHaveLength(6);
		expect(screen.queryByRole('button', { name: en.hearth_add_entity })).toBeNull();
		expect(last().fields.entities).toHaveLength(2);
		expect(screen.getAllByText(en.hearth_empty_row_removed)).toHaveLength(4);
	});

	it('stores a role chosen for a row and goes back to the default', async () => {
		const { last } = open();
		await fireEvent.click(chips(en.hearth_good)[0]);
		expect(last().fields.entities?.[0]).toMatchObject({ color: 'good' });
		await fireEvent.click(chips(en.hearth_default)[0]);
		expect(last().fields.entities?.[0]).not.toHaveProperty('color');
	});

	it('removes a row, keeps the next as it was and moves focus to it', async () => {
		const { last } = open();
		await fireEvent.click(screen.getByRole('button', { name: 'Remove entity 1' }));
		expect(entityInputs().map((input) => input.value)).toEqual(['sensor.bedroom']);
		expect(chips(en.hearth_custom)[0].getAttribute('aria-pressed')).toBe('true');
		expect(last().fields.entities).toEqual([{ entity: 'sensor.bedroom', color: 'orange' }]);
		await vi.waitFor(() => expect(document.activeElement).toBe(entityInputs()[0]));
		// the last row stays, since a chart needs one
		expect(screen.queryByRole('button', { name: 'Remove entity 1' })).toBeNull();
	});

	it('names each row, so two rows can be told apart', () => {
		open();
		expect(screen.getByRole('group', { name: 'Entity 1' })).toBeTruthy();
		expect(screen.getByRole('group', { name: 'Entity 2' })).toBeTruthy();
	});

	it('blocks Done on a color styleColor rejects', async () => {
		const { last } = open();
		await fireEvent.input(screen.getByRole('textbox', { name: en.hearth_segment_custom_color }), {
			target: { value: 'red; background: url(x)' }
		});
		expect(last().valid).toBe(false);
		expect(screen.getByText(en.hearth_style_color_invalid)).toBeTruthy();
	});

	it('stores the name, style and period', async () => {
		const { last } = open();
		await fireEvent.input(screen.getAllByLabelText(en.hearth_name_optional)[0], {
			target: { value: 'Rooms' }
		});
		await fireEvent.change(screen.getByLabelText(en.hearth_period), { target: { value: 'month' } });
		expect(last().fields).toMatchObject({ name: 'Rooms', style: 'bar', period: 'month' });
	});
});
