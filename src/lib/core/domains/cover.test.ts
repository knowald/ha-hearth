import { describe, expect, it, vi } from 'vitest';
import { states } from '../ha/entities';
import { hassEntity } from '../ha/testing';
import { guardCoverMotion, type CoverConfirmation } from './cover';

describe('guardCoverMotion', () => {
	it('runs the action right away for an ordinary blind', () => {
		states.set({
			'cover.blind': hassEntity('cover.blind', 'open', { device_class: 'blind' })
		});
		const action = vi.fn();
		const confirm = vi.fn();
		guardCoverMotion(['cover.blind'], false, action, confirm);
		expect(action).toHaveBeenCalledOnce();
		expect(confirm).not.toHaveBeenCalled();
	});

	it('asks with localized copy before moving a garage door', () => {
		states.set({
			'cover.garage': hassEntity('cover.garage', 'closed', {
				device_class: 'garage',
				friendly_name: 'Garage'
			})
		});
		const action = vi.fn();
		let request: CoverConfirmation | undefined;
		guardCoverMotion(['cover.garage'], true, action, (asked) => (request = asked));
		expect(action).not.toHaveBeenCalled();
		expect(request?.title).toBe('Open Garage?');
		expect(request?.confirmLabel).toBe('Open');
		request?.action();
		expect(action).toHaveBeenCalledOnce();
	});

	it('names only the access points when a group includes one', () => {
		states.set({
			'cover.blind': hassEntity('cover.blind', 'open', { friendly_name: 'Blind' }),
			'cover.gate': hassEntity('cover.gate', 'open', {
				device_class: 'gate',
				friendly_name: 'Gate'
			})
		});
		const confirm = vi.fn();
		guardCoverMotion(['cover.blind', 'cover.gate'], false, vi.fn(), confirm);
		expect(confirm.mock.calls[0][0].title).toBe('Close Gate?');
	});
});
