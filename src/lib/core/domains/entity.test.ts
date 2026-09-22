import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { states } from '../ha/entities';
import { hassEntity } from '../ha/testing';

vi.mock('../ha/commands', async (importOriginal) => ({
	...(await importOriginal<typeof import('../ha/commands')>()),
	service: vi.fn(),
	callEntityService: vi.fn()
}));
import { callEntityService, controlOverrides, service } from '../ha/commands';
import { setEntityActive, setSliderValue, toggleEntity } from './entity';

describe('toggleEntity', () => {
	beforeEach(() => vi.mocked(service).mockClear());

	it('activates a scene that still reports unknown', () => {
		states.set({ 'scene.movie': hassEntity('scene.movie', 'unknown') });
		expect(toggleEntity('scene.movie')).toBe(true);
		expect(service).toHaveBeenCalledWith('scene', 'turn_on', { entity_id: 'scene.movie' });
	});

	it('sends nothing to an unavailable entity', () => {
		states.set({ 'switch.pump': hassEntity('switch.pump', 'unavailable') });
		expect(toggleEntity('switch.pump')).toBe(false);
		expect(service).not.toHaveBeenCalled();
	});
});

describe('setEntityActive', () => {
	it('turns a group off through homeassistant, with the override applied at once', () => {
		states.set({ 'group.downstairs': hassEntity('group.downstairs', 'on') });
		setEntityActive('group.downstairs', false);
		expect(callEntityService).toHaveBeenCalledWith('homeassistant', 'turn_off', 'group.downstairs');
		expect(get(controlOverrides)['active:group.downstairs']).toBe(0);
	});
});

describe('setSliderValue', () => {
	it('previews without sending until the value is committed', () => {
		states.set({ 'number.speed': hassEntity('number.speed', '0') });
		const send = vi.fn();
		setSliderValue('number.speed', 'value', 20, false, send);
		expect(get(controlOverrides)['value:number.speed']).toBe(20);
		expect(send).not.toHaveBeenCalled();
		setSliderValue('number.speed', 'value', 25, true, send);
		expect(send).toHaveBeenCalledWith(25);
	});
});
