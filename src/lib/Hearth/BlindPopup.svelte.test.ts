import { fireEvent, render, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import BlindPopup from './BlindPopup.svelte';

vi.mock('$lib/core/ha/commands', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/core/ha/commands')>()),
	service: vi.fn()
}));
import { service } from '$lib/core/ha/commands';
import { confirmRequestedAction, dismissConfirmation, requestedConfirmation } from './store';

describe('BlindPopup', () => {
	beforeEach(() => {
		vi.mocked(service).mockClear();
		dismissConfirmation();
	});

	it('asks before opening a gate from its popup', async () => {
		states.set({
			'cover.gate': hassEntity('cover.gate', 'closed', {
				device_class: 'gate',
				friendly_name: 'Gate',
				current_position: 0
			})
		});
		render(BlindPopup, { entity: 'cover.gate' });
		await fireEvent.click(screen.getByRole('button', { name: 'Open fully' }));
		expect(get(requestedConfirmation)?.title).toBe('Open Gate?');
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(service).not.toHaveBeenCalled();
		confirmRequestedAction();
		await vi.waitFor(() =>
			expect(service).toHaveBeenCalledWith('cover', 'set_cover_position', {
				entity_id: 'cover.gate',
				position: 100
			})
		);
	});

	it('asks before closing a gate from its popup', async () => {
		states.set({
			'cover.gate': hassEntity('cover.gate', 'open', {
				device_class: 'gate',
				friendly_name: 'Gate',
				current_position: 100
			})
		});
		render(BlindPopup, { entity: 'cover.gate' });
		await fireEvent.click(screen.getByRole('button', { name: 'Close cover' }));
		expect(get(requestedConfirmation)?.title).toBe('Close Gate?');
	});
});
