import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { states } from '../ha/entities';
import { hassEntity } from '../ha/testing';
import { translation } from '../i18n';

vi.mock('../ha/commands', async (importOriginal) => ({
	...(await importOriginal<typeof import('../ha/commands')>()),
	callEntityService: vi.fn()
}));
import { callEntityService, controlOverrides } from '../ha/commands';
import { guardLockCommand } from './lock';

describe('guardLockCommand', () => {
	beforeEach(() => {
		vi.mocked(callEntityService).mockClear();
		states.set({ 'lock.front': hassEntity('lock.front', 'locked', { friendly_name: 'Front' }) });
	});

	it('locks right away', () => {
		const confirm = vi.fn();
		guardLockCommand('lock.front', 'lock', confirm);
		expect(confirm).not.toHaveBeenCalled();
		expect(callEntityService).toHaveBeenCalledWith('lock', 'lock', 'lock.front');
		expect(get(controlOverrides)['active:lock.front']).toBe(0);
	});

	it.each([
		['unlock', 'Deverrouiller Front ?', 'Deverrouiller'],
		['open', 'Ouvrir Front ?', 'Ouvrir la porte']
	] as const)('asks in the active language before %s', (command, message, confirmLabel) => {
		const english = get(translation);
		translation.set({
			...english,
			hearth_unlock_confirm_message: 'Deverrouiller {label} ?',
			hearth_open_door_confirm_message: 'Ouvrir {label} ?',
			hearth_unlock: 'Deverrouiller',
			hearth_open_door: 'Ouvrir la porte'
		});
		const confirm = vi.fn();
		guardLockCommand('lock.front', command, confirm);
		translation.set(english);
		expect(callEntityService).not.toHaveBeenCalled();
		expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ message, confirmLabel }));
		confirm.mock.calls[0][0].action();
		expect(callEntityService).toHaveBeenCalledWith('lock', command, 'lock.front');
	});

	it('names the lock by the label it is given', () => {
		const confirm = vi.fn();
		guardLockCommand('lock.front', 'unlock', confirm, 'Porch');
		expect(confirm.mock.calls[0][0].message).toContain('Porch');
	});
});
