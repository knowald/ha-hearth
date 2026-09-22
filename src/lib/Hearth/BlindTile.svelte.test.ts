import { fireEvent, render, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { translation } from '$lib/core/i18n';
import { hassEntity } from '$lib/core/ha/testing';
import BlindTile from './BlindTile.svelte';

vi.mock('$lib/core/domains/cover', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/core/domains/cover')>()),
	toggleBlind: vi.fn()
}));
import { toggleBlind } from '$lib/core/domains/cover';
import { confirmRequestedAction, dismissConfirmation, requestedConfirmation } from './store';

describe('BlindTile', () => {
	beforeEach(() => {
		vi.mocked(toggleBlind).mockClear();
		dismissConfirmation();
	});

	it('asks in the active language before opening a garage door', async () => {
		states.set({
			'cover.garage': hassEntity('cover.garage', 'closed', {
				device_class: 'garage',
				current_position: 0
			})
		});
		const english = get(translation);
		translation.set({
			...english,
			hearth_open_cover_question: '{label} ouvrir ?',
			hearth_open: 'Ouvrir'
		});
		render(BlindTile, { entity: 'cover.garage', name: 'Garage' });
		await fireEvent.click(screen.getByRole('button'));
		translation.set(english);
		expect(toggleBlind).not.toHaveBeenCalled();
		expect(get(requestedConfirmation)).toMatchObject({
			title: 'Garage ouvrir ?',
			confirmLabel: 'Ouvrir'
		});
		confirmRequestedAction();
		expect(toggleBlind).toHaveBeenCalledWith('cover.garage');
	});

	it('toggles an ordinary blind without asking', async () => {
		states.set({ 'cover.blind': hassEntity('cover.blind', 'open', { current_position: 100 }) });
		render(BlindTile, { entity: 'cover.blind' });
		await fireEvent.click(screen.getByRole('button'));
		expect(get(requestedConfirmation)).toBeNull();
		expect(toggleBlind).toHaveBeenCalledWith('cover.blind');
	});

	it('still accepts commands while the cover reports unknown', async () => {
		states.set({ 'cover.blind': hassEntity('cover.blind', 'unknown') });
		render(BlindTile, { entity: 'cover.blind' });
		const tile = screen.getByRole('button');
		expect(tile.classList.contains('unreachable')).toBe(false);
		await fireEvent.click(tile);
		expect(toggleBlind).toHaveBeenCalledWith('cover.blind');
	});
});
