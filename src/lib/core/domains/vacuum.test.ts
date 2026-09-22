import { beforeEach, describe, expect, it, vi } from 'vitest';
import { states, getTogglableService } from '../ha/entities';
import { hassEntity } from '../ha/testing';

vi.mock('../ha/commands', async (importOriginal) => ({
	...(await importOriginal<typeof import('../ha/commands')>()),
	service: vi.fn()
}));
import { service } from '../ha/commands';
import { toggleVacuum, vacuumActions } from './vacuum';

describe('vacuum primary action', () => {
	beforeEach(() => vi.mocked(service).mockClear());

	it.each([
		['cleaning', 'vacuum.return_to_base'],
		['returning', 'vacuum.return_to_base'],
		['docked', 'vacuum.start'],
		['paused', 'vacuum.start'],
		['idle', 'vacuum.start']
	])('a %s vacuum tile sends %s', (state, expected) => {
		expect(getTogglableService(hassEntity('vacuum.robot', state))).toBe(expected);
	});

	it('sends a returning vacuum home from the card instead of restarting it', () => {
		states.set({ 'vacuum.robot': hassEntity('vacuum.robot', 'returning') });
		toggleVacuum('vacuum.robot');
		expect(service).toHaveBeenCalledWith('vacuum', 'return_to_base', {
			entity_id: 'vacuum.robot'
		});
	});

	it('starts a docked vacuum from the card', () => {
		states.set({ 'vacuum.robot': hassEntity('vacuum.robot', 'docked') });
		toggleVacuum('vacuum.robot');
		expect(service).toHaveBeenCalledWith('vacuum', 'start', { entity_id: 'vacuum.robot' });
	});

	it.each([
		['cleaning', ['pause', 'return_to_base']],
		['paused', ['start', 'return_to_base']],
		['idle', ['start', 'return_to_base']],
		['docked', ['start']]
	])('offers a %s vacuum %s', (state, commands) => {
		expect(vacuumActions(state).map((action) => action.command)).toEqual(commands);
	});

	it('adds locate last when the vacuum supports it', () => {
		expect(vacuumActions('docked', 512).map((action) => action.command)).toEqual([
			'start',
			'locate'
		]);
	});
});
