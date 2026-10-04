import { fireEvent, render, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import en from '../../../../static/translations/en.json';
import { DEFAULT_HEARTH_CONFIG } from '../config';
import { cancelEdit, editor, enterEditMode, hearthConfig } from '../store';
import AlertEditSheet from './AlertEditSheet.svelte';

describe('AlertEditSheet', () => {
	beforeEach(() => {
		hearthConfig.set({
			...structuredClone(DEFAULT_HEARTH_CONFIG),
			alerts: [
				{
					id: 'fridge',
					title: 'Fridge door open',
					severity: 'warning',
					conditions: [{ entity: 'binary_sensor.fridge_door', state: 'on' }],
					for_seconds: 120
				}
			]
		});
		enterEditMode();
	});

	afterEach(() => {
		cancelEdit();
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
	});

	it('saves an edited rule and returns to settings', async () => {
		render(AlertEditSheet, { index: 0 });
		await fireEvent.input(screen.getByLabelText(en.hearth_title), {
			target: { value: 'Fridge still open' }
		});
		await fireEvent.input(screen.getByLabelText(en.hearth_alert_delay), {
			target: { value: '60' }
		});
		await fireEvent.click(screen.getByRole('button', { name: en.done }));
		expect(get(hearthConfig).alerts).toEqual([
			{
				id: 'fridge',
				title: 'Fridge still open',
				message: undefined,
				icon: undefined,
				severity: 'warning',
				conditions: [{ entity: 'binary_sensor.fridge_door', state: 'on' }],
				for_seconds: 60,
				entity: undefined,
				popup: undefined,
				auto_close: undefined
			}
		]);
		expect(get(editor)).toEqual({ kind: 'settings' });
	});

	it('picks a chime for the rule, or leaves it to the severity', async () => {
		render(AlertEditSheet, { index: 0 });
		const sound = screen.getByLabelText(en.hearth_alert_chime) as HTMLSelectElement;
		expect(sound.value).toBe('');
		await fireEvent.change(sound, { target: { value: 'chime' } });
		await fireEvent.click(screen.getByRole('button', { name: en.done }));
		expect(get(hearthConfig).alerts?.[0].chime).toBe(true);
	});

	it('blocks Done for a delay that is not a whole number of seconds', async () => {
		render(AlertEditSheet, { index: 0 });
		await fireEvent.input(screen.getByLabelText(en.hearth_alert_delay), {
			target: { value: '1.5' }
		});
		expect(screen.getByText(en.hearth_alert_delay_invalid)).toBeTruthy();
		expect(screen.getByRole('button', { name: en.done })).toHaveProperty('disabled', true);
	});

	it('needs a condition before a new rule can be added', () => {
		render(AlertEditSheet, { index: null });
		expect(screen.getByRole('button', { name: en.done })).toHaveProperty('disabled', true);
	});

	it('says why Done is disabled, the title first, then the conditions', async () => {
		render(AlertEditSheet, { index: null });
		const done = screen.getByRole('button', { name: en.done });
		const titleReason = en.hearth_field_required.replace('{field}', en.hearth_title);
		const reason = screen.getByText(titleReason);
		expect(done.getAttribute('aria-describedby')).toBe(reason.id);
		expect(screen.getByLabelText(en.hearth_title).getAttribute('aria-required')).toBe('true');
		await fireEvent.input(screen.getByLabelText(en.hearth_title), {
			target: { value: 'Door open' }
		});
		expect(screen.queryByText(titleReason)).toBeNull();
		expect(screen.getByText(en.hearth_alert_needs_condition)).toBeTruthy();
	});

	it('points a bad delay back at its field', async () => {
		render(AlertEditSheet, { index: 0 });
		await fireEvent.input(screen.getByLabelText(en.hearth_alert_delay), {
			target: { value: '-3' }
		});
		expect(screen.getByText(en.hearth_fix_marked_fields)).toBeTruthy();
	});
});
