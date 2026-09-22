import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import { dismissConfirmation, requestedConfirmation } from './store';
import DetailPopup from './DetailPopup.svelte';

vi.mock('$lib/core/ha/commands', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/core/ha/commands')>()),
	callEntityService: vi.fn(),
	service: vi.fn()
}));
vi.mock('$lib/core/domains/climate', () => ({
	setClimateHvacMode: vi.fn(),
	setClimateTemperature: vi.fn()
}));
import {
	callEntityService,
	controlOverrides,
	markPending,
	pendingEntities,
	service,
	setControlOverride
} from '$lib/core/ha/commands';
import { setClimateHvacMode, setClimateTemperature } from '$lib/core/domains/climate';

const calls = vi.mocked(callEntityService);
const sent = vi.mocked(service);

function pointer(type: string, clientX: number) {
	const event = new Event(type) as PointerEvent;
	Object.defineProperties(event, {
		clientX: { value: clientX },
		pointerId: { value: 1 }
	});
	return event;
}

// a slider spanning x 0-200, so clientX / 2 is the fraction in percent
async function slider() {
	const node = await screen.findByRole('slider');
	node.getBoundingClientRect = () => ({ left: 0, width: 200 }) as DOMRect;
	return node;
}

describe('DetailPopup', () => {
	beforeEach(() => {
		calls.mockReset();
		sent.mockClear();
		vi.mocked(setClimateTemperature).mockClear();
		controlOverrides.set({});
		pendingEntities.set({});
		dismissConfirmation();
	});

	it('offers on, off and toggle for a switch', async () => {
		states.set({ 'switch.fan': hassEntity('switch.fan', 'on', { friendly_name: 'Fan' }) });
		render(DetailPopup, { entity: 'switch.fan' });
		await fireEvent.click(await screen.findByRole('button', { name: 'Turn off' }));
		expect(calls).toHaveBeenCalledWith('switch', 'turn_off', 'switch.fan');
	});

	it('asks before unlocking and opens a latch only when supported', async () => {
		states.set({
			'lock.front': hassEntity('lock.front', 'locked', {
				friendly_name: 'Front',
				supported_features: 1
			})
		});
		render(DetailPopup, { entity: 'lock.front' });
		await fireEvent.click(await screen.findByRole('button', { name: 'Unlock' }));
		expect(calls).not.toHaveBeenCalled();
		expect(get(requestedConfirmation)?.confirmLabel).toBe('Unlock');
		expect(screen.getByRole('button', { name: 'Open door' })).toBeTruthy();
	});

	it('selects an option', async () => {
		states.set({
			'input_select.mode': hassEntity('input_select.mode', 'Home', { options: ['Home', 'Away'] })
		});
		render(DetailPopup, { entity: 'input_select.mode' });
		await fireEvent.click(await screen.findByRole('button', { name: 'Away' }));
		expect(calls).toHaveBeenCalledWith('input_select', 'select_option', 'input_select.mode', {
			option: 'Away'
		});
	});

	it('steps a number by its configured step', async () => {
		states.set({
			'input_number.volume': hassEntity('input_number.volume', '4', { min: 0, max: 10, step: 2 })
		});
		render(DetailPopup, { entity: 'input_number.volume' });
		const increase = await screen.findByRole('button', { name: 'Increase' });
		await fireEvent.click(increase);
		expect(sent).toHaveBeenLastCalledWith('input_number', 'set_value', {
			entity_id: 'input_number.volume',
			value: 6
		});
	});

	it('steps a number from the value already sent, not the stale state', async () => {
		vi.useFakeTimers();
		states.set({
			'input_number.volume': hassEntity('input_number.volume', '4', { min: 0, max: 10, step: 2 })
		});
		render(DetailPopup, { entity: 'input_number.volume' });
		await vi.waitFor(() => screen.getByRole('button', { name: 'Increase' }));
		const increase = screen.getByRole('button', { name: 'Increase' });
		await fireEvent.click(increase);
		await fireEvent.click(increase);
		expect(screen.getByRole('slider').getAttribute('aria-valuenow')).toBe('8');
		// the throttle sends the latest value once its window closes
		vi.advanceTimersByTime(500);
		expect(sent).toHaveBeenLastCalledWith('input_number', 'set_value', {
			entity_id: 'input_number.volume',
			value: 8
		});
		vi.useRealTimers();
	});

	it('holds a number slider back until release when the card asks for it', async () => {
		states.set({
			'number.speed': hassEntity('number.speed', '0', { min: 0, max: 50, step: 5 })
		});
		render(DetailPopup, { entity: 'number.speed', sliderUpdates: 'release' });
		const bar = await slider();
		bar.dispatchEvent(pointer('pointerdown', 0));
		bar.dispatchEvent(pointer('pointermove', 83));
		expect(sent).not.toHaveBeenCalled();
		await vi.waitFor(() => expect(bar.getAttribute('aria-valuenow')).toBe('20'));
		bar.dispatchEvent(pointer('pointerup', 83));
		// 41.5% of 0-50 is 20.75, which snaps to the entity's step of 5
		expect(sent).toHaveBeenCalledWith('number', 'set_value', {
			entity_id: 'number.speed',
			value: 20
		});
	});

	it('steps the target humidity by the entity step from the keyboard', async () => {
		states.set({
			'humidifier.bedroom': hassEntity('humidifier.bedroom', 'on', {
				humidity: 50,
				min_humidity: 30,
				max_humidity: 80,
				target_humidity_step: 5
			})
		});
		render(DetailPopup, { entity: 'humidifier.bedroom' });
		await fireEvent.keyDown(await slider(), { key: 'ArrowRight' });
		expect(sent).toHaveBeenCalledWith('humidifier', 'set_humidity', {
			entity_id: 'humidifier.bedroom',
			humidity: 55
		});
	});

	it('sets a valve position through the shared slider', async () => {
		states.set({
			'valve.garden': hassEntity('valve.garden', 'open', {
				supported_features: 4,
				current_position: 30
			})
		});
		render(DetailPopup, { entity: 'valve.garden' });
		const bar = await slider();
		expect(bar.getAttribute('aria-valuenow')).toBe('30');
		await fireEvent.keyDown(bar, { key: 'End' });
		expect(sent).toHaveBeenCalledWith('valve', 'set_valve_position', {
			entity_id: 'valve.garden',
			position: 100
		});
	});

	it('steps a water heater by its target step and from the value already sent', async () => {
		states.set({
			'water_heater.tank': hassEntity('water_heater.tank', 'eco', {
				supported_features: 1,
				temperature: 50,
				target_temp_step: 0.5,
				min_temp: 40,
				max_temp: 60
			})
		});
		render(DetailPopup, { entity: 'water_heater.tank' });
		const increase = await screen.findByRole('button', { name: 'Increase' });
		await fireEvent.click(increase);
		await fireEvent.click(increase);
		expect(calls).toHaveBeenLastCalledWith('water_heater', 'set_temperature', 'water_heater.tank', {
			temperature: 51
		});
	});

	it('steps a thermostat from the value already sent, like the climate card', async () => {
		states.set({
			'climate.living': hassEntity('climate.living', 'heat', {
				temperature: 21,
				target_temp_step: 0.5
			})
		});
		setControlOverride('climate:climate.living', 22);
		render(DetailPopup, { entity: 'climate.living' });
		await fireEvent.click(await screen.findByRole('button', { name: 'Increase' }));
		expect(setClimateTemperature).toHaveBeenCalledWith('climate.living', 22.5);
	});

	it('shows a numeric reading once, without a state line repeating it', async () => {
		states.set({
			'sensor.temp': hassEntity('sensor.temp', '21.46', { unit_of_measurement: '°C' })
		});
		const { container } = render(DetailPopup, { entity: 'sensor.temp' });
		await waitFor(() => expect(container.querySelector('.reading')).not.toBeNull());
		expect(container.querySelector('.state-line')).toBeNull();
		expect(container.querySelector('.reading .value')?.textContent).toBe('21.5');
	});

	it('highlights the pressed switch segment at once and pulses only that one', async () => {
		calls.mockImplementation((_domain, _name, entityId) => markPending(entityId));
		states.set({ 'switch.fan': hassEntity('switch.fan', 'on') });
		render(DetailPopup, { entity: 'switch.fan' });
		const off = await screen.findByRole('button', { name: 'Turn off' });
		const on = screen.getByRole('button', { name: 'Turn on' });
		await fireEvent.click(off);
		expect(off.classList.contains('active')).toBe(true);
		expect(on.classList.contains('active')).toBe(false);
		expect(off.classList.contains('pending')).toBe(true);
		expect(on.classList.contains('pending')).toBe(false);
	});

	it('locks without asking and asks before opening the latch', async () => {
		states.set({
			'lock.front': hassEntity('lock.front', 'unlocked', {
				friendly_name: 'Front',
				supported_features: 1
			})
		});
		render(DetailPopup, { entity: 'lock.front' });
		await fireEvent.click(await screen.findByRole('button', { name: 'Lock' }));
		expect(calls).toHaveBeenCalledWith('lock', 'lock', 'lock.front');
		expect(get(requestedConfirmation)).toBeNull();
		await fireEvent.click(screen.getByRole('button', { name: 'Open door' }));
		expect(get(requestedConfirmation)).toMatchObject({
			message: 'Open Front?',
			confirmLabel: 'Open door'
		});
	});

	it('offers the vacuum the same state-dependent commands as its card', async () => {
		states.set({
			'vacuum.robot': hassEntity('vacuum.robot', 'cleaning', { supported_features: 512 })
		});
		render(DetailPopup, { entity: 'vacuum.robot' });
		await screen.findByRole('button', { name: 'Pause' });
		const labels = screen.getAllByRole('button').map((button) => button.textContent?.trim());
		expect(labels).toEqual(expect.arrayContaining(['Pause', 'Send home', 'Locate']));
		expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
	});

	it('arms an alarm with the modes it supports and passes the code', async () => {
		states.set({
			'alarm_control_panel.home': hassEntity('alarm_control_panel.home', 'disarmed', {
				supported_features: 3,
				code_format: 'number'
			})
		});
		render(DetailPopup, { entity: 'alarm_control_panel.home' });
		await screen.findByRole('button', { name: 'Arm away' });
		expect(screen.queryByRole('button', { name: 'Arm night' })).toBeNull();
		await fireEvent.input(screen.getByPlaceholderText('Code'), { target: { value: '1234' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Arm away' }));
		expect(calls).toHaveBeenCalledWith(
			'alarm_control_panel',
			'alarm_arm_away',
			'alarm_control_panel.home',
			{ code: '1234' }
		);
	});

	it('shows a thermostat with its modes', async () => {
		states.set({
			'climate.living': hassEntity('climate.living', 'heat', {
				temperature: 21,
				current_temperature: 19.5,
				hvac_modes: ['off', 'heat'],
				target_temp_step: 0.5
			})
		});
		render(DetailPopup, { entity: 'climate.living' });
		await fireEvent.click(await screen.findByRole('button', { name: 'Off' }));
		expect(setClimateHvacMode).toHaveBeenCalledWith('climate.living', 'off');
	});

	it('falls back to attributes for a plain readout', async () => {
		states.set({
			'binary_sensor.door': hassEntity('binary_sensor.door', 'off', {
				friendly_name: 'Door',
				device_class: 'door'
			})
		});
		render(DetailPopup, { entity: 'binary_sensor.door' });
		await waitFor(() =>
			expect(screen.getByText('This entity has no controls', { exact: false })).toBeTruthy()
		);
		await fireEvent.click(screen.getByRole('button', { name: /Attributes/ }));
		expect(screen.getByText('device_class')).toBeTruthy();
		expect(screen.getByText('door')).toBeTruthy();
	});
});
