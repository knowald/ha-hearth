import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import en from '../../../../static/translations/en.json';
import { DEFAULT_HEARTH_CONFIG } from '../config';
import { editor, hearthConfig } from '../store';
import RoomEditSheet from './RoomEditSheet.svelte';

describe('RoomEditSheet', () => {
	beforeEach(() => {
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
		states.set({
			'sensor.living_temperature': hassEntity('sensor.living_temperature', '21', {
				friendly_name: 'Living temperature',
				device_class: 'temperature'
			}),
			'sensor.living_humidity': hassEntity('sensor.living_humidity', '45', {
				friendly_name: 'Living humidity',
				device_class: 'humidity'
			}),
			'sensor.power': hassEntity('sensor.power', '120', { friendly_name: 'Power' })
		});
	});

	afterEach(() => {
		editor.set(null);
	});

	it('names the missing page name beside the disabled Done', async () => {
		render(RoomEditSheet, { id: null });
		const done = screen.getByRole('button', { name: en.done });
		const reason = en.hearth_field_required.replace('{field}', en.name);
		expect(done).toHaveProperty('disabled', true);
		expect(screen.getByText(reason)).toBeTruthy();
		expect(screen.getByLabelText(en.name).getAttribute('aria-required')).toBe('true');
		await fireEvent.input(screen.getByLabelText(en.name), { target: { value: 'Garage' } });
		expect(done).toHaveProperty('disabled', false);
		expect(screen.queryByText(reason)).toBeNull();
	});

	it.each([
		[en.hearth_temperature_sensor, 'Living temperature'],
		[en.hearth_humidity_sensor, 'Living humidity']
	])('offers only matching sensors for the %s', async (label, expected) => {
		render(RoomEditSheet, { id: null });
		const field = screen.getByLabelText(label).closest('.field') as HTMLElement;
		await fireEvent.click(within(field).getByRole('button', { name: en.hearth_choose_entity }));
		const picker = screen.getByRole('dialog', { name: en.hearth_choose_entity });
		const options = within(picker).getAllByRole('option');
		expect(options).toHaveLength(1);
		expect(options[0].textContent).toContain(expected);
	});
});
