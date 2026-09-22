import { fireEvent, render, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import Card from './Card.svelte';

vi.mock('$lib/core/domains/cover', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/core/domains/cover')>()),
	setAllCovers: vi.fn()
}));
import { setAllCovers } from '$lib/core/domains/cover';
import { confirmRequestedAction, dismissConfirmation, requestedConfirmation } from '../../store';

describe('entities card group actions', () => {
	beforeEach(() => {
		vi.mocked(setAllCovers).mockClear();
		dismissConfirmation();
	});

	it('asks before Open all moves a garage door along with the blinds', async () => {
		states.set({
			'cover.blind': hassEntity('cover.blind', 'closed', { friendly_name: 'Blind' }),
			'cover.garage': hassEntity('cover.garage', 'closed', {
				device_class: 'garage',
				friendly_name: 'Garage'
			})
		});
		render(Card, {
			card: {
				id: 'e',
				type: 'entities',
				title: 'Outside',
				entities: [{ entity: 'cover.blind' }, { entity: 'cover.garage' }]
			}
		});
		await fireEvent.click(screen.getByText('Open all'));
		expect(setAllCovers).not.toHaveBeenCalled();
		expect(get(requestedConfirmation)?.title).toBe('Open Garage?');
		confirmRequestedAction();
		expect(setAllCovers).toHaveBeenCalledWith(['cover.blind', 'cover.garage'], true);
	});
});
