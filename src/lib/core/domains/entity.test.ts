import { beforeEach, describe, expect, it, vi } from 'vitest';
import { states } from '../ha/entities';
import { hassEntity } from '../ha/testing';

vi.mock('../ha/commands', async (importOriginal) => ({
	...(await importOriginal<typeof import('../ha/commands')>()),
	service: vi.fn()
}));
import { service } from '../ha/commands';
import { toggleEntity } from './entity';

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
