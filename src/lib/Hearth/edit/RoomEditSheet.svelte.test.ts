import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import { english as en } from '$lib/core/i18n/testing';
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
			'sensor.power': hassEntity('sensor.power', '120', { friendly_name: 'Power' }),
			// a template sensor that declares only its unit
			'sensor.attic': hassEntity('sensor.attic', '17', {
				friendly_name: 'Attic',
				unit_of_measurement: '\u00b0C'
			})
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

	it('saves a time window with weekdays as the page visibility', async () => {
		render(RoomEditSheet, { id: 'home' });
		await fireEvent.click(screen.getByRole('button', { name: en.conditions }));
		await fireEvent.click(screen.getByRole('button', { name: en.add_condition }));
		await fireEvent.change(screen.getByLabelText(en.hearth_condition_type), {
			target: { value: 'time' }
		});
		await fireEvent.input(screen.getByLabelText(en.hearth_after), { target: { value: '7pm' } });
		expect(screen.getByText(en.hearth_time_format)).toBeTruthy();
		await fireEvent.input(screen.getByLabelText(en.hearth_after), { target: { value: '22:00' } });
		await fireEvent.input(screen.getByLabelText(en.hearth_before), { target: { value: '06:00' } });
		const weekdays = within(screen.getByRole('group', { name: en.hearth_weekdays }));
		const [, , , , friday] = weekdays.getAllByRole('button');
		await fireEvent.click(friday);
		expect(friday.getAttribute('aria-pressed')).toBe('true');
		await fireEvent.click(screen.getByRole('button', { name: en.done }));
		expect(get(hearthConfig).rooms[0].visibility).toEqual([
			{ time: { after: '22:00', before: '06:00', weekdays: ['fri'] } }
		]);
	});

	it('saves the device names of a device condition as a list', async () => {
		render(RoomEditSheet, { id: 'home' });
		await fireEvent.click(screen.getByRole('button', { name: en.conditions }));
		await fireEvent.click(screen.getByRole('button', { name: en.add_condition }));
		await fireEvent.change(screen.getByLabelText(en.hearth_condition_type), {
			target: { value: 'device' }
		});
		await fireEvent.input(screen.getByLabelText(en.hearth_device_names), {
			target: { value: 'kitchen, hall' }
		});
		await fireEvent.click(screen.getByRole('button', { name: en.done }));
		expect(get(hearthConfig).rooms[0].visibility).toEqual([{ device: ['kitchen', 'hall'] }]);
	});

	it.each([
		[en.hearth_temperature_sensor, ['Attic', 'Living temperature']],
		[en.hearth_humidity_sensor, ['Living humidity']]
	])('lists fitting sensors first for the %s', async (label, expected) => {
		render(RoomEditSheet, { id: null });
		const field = screen.getByLabelText(label).closest('.field') as HTMLElement;
		await fireEvent.click(within(field).getByRole('button', { name: en.hearth_choose_entity }));
		const picker = screen.getByRole('dialog', { name: en.hearth_choose_entity });
		const options = within(picker).getAllByRole('option');
		// the rest stay reachable below, for a sensor that declares neither
		expect(options).toHaveLength(4);
		expected.forEach((name, index) => expect(options[index].textContent).toContain(name));
	});
});
