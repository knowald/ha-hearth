import { get } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';
import { hassEntity } from '../ha/testing';

vi.mock('../ha/commands', async (importOriginal) => ({
	...(await importOriginal<typeof import('../ha/commands')>()),
	service: vi.fn()
}));
import { controlOverrides } from '../ha/commands';
import { fanSpeedFor, setFanSpeed } from './fan';

describe('fan speed', () => {
	const states = { 'fan.desk': hassEntity('fan.desk', 'on', { percentage: 66 }) };

	it('reads the reported speed, and 0 while the fan is off', () => {
		expect(fanSpeedFor('fan.desk', states, {})).toBe(66);
		expect(fanSpeedFor('fan.desk', { 'fan.desk': hassEntity('fan.desk', 'off') }, {})).toBe(0);
		expect(fanSpeedFor('fan.desk', states, { 'active:fan.desk': 0 })).toBe(0);
	});

	it('shows the chosen speed before Home Assistant confirms it', () => {
		setFanSpeed('fan.desk', 100);
		expect(fanSpeedFor('fan.desk', states, get(controlOverrides))).toBe(100);
	});
});
