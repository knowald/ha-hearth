import { fireEvent, render, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callService, type Connection } from 'home-assistant-js-websocket';
import { connection, health } from '$lib/core/ha/connection';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import { setCommandGate } from '$lib/core/ha/commands';
import { closePopup, hearthEditMode, popup } from '../../store';
import Card from './Card.svelte';

vi.mock('home-assistant-js-websocket', async (importOriginal) => ({
	...(await importOriginal<typeof import('home-assistant-js-websocket')>()),
	callService: vi.fn(() => Promise.resolve())
}));

const PLAYER = 'media_player.kitchen';

function playing(attributes: Record<string, unknown> = {}) {
	states.set({
		[PLAYER]: hassEntity(PLAYER, 'playing', {
			friendly_name: 'Kitchen',
			media_title: 'Blue in Green',
			media_artist: 'Miles Davis',
			media_duration: 300,
			media_position: 60,
			media_position_updated_at: new Date().toISOString(),
			...attributes
		})
	});
}

function hitArea(container: HTMLElement) {
	return container.querySelector<HTMLElement>('.open-hit');
}

beforeEach(() => {
	connection.set({} as Connection);
	health.set('connected');
	closePopup();
});

afterEach(() => {
	vi.clearAllMocks();
	hearthEditMode.set(false);
	setCommandGate(() => true);
	closePopup();
	connection.set(undefined as unknown as Connection);
	health.set('lost');
});

describe('media card', () => {
	it('opens the full player for its entity from a tap on the card', async () => {
		playing();
		const { container } = render(Card, {
			card: { id: 'music', type: 'media', entity: PLAYER }
		});
		await fireEvent.click(hitArea(container)!);
		expect(get(popup)).toMatchObject({ kind: 'media', entity: PLAYER, name: 'Kitchen' });
		expect(callService).not.toHaveBeenCalled();
	});

	it('opens the same player from the Open controls button', async () => {
		playing();
		render(Card, { card: { id: 'music', type: 'media', entity: PLAYER } });
		await fireEvent.click(screen.getByRole('button', { name: 'Open controls' }));
		expect(get(popup)).toMatchObject({ kind: 'media', entity: PLAYER });
	});

	it('pauses from the play button without opening the player', async () => {
		playing();
		render(Card, { card: { id: 'music', type: 'media', entity: PLAYER } });
		await fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
		expect(callService).toHaveBeenCalledWith(
			{},
			'media_player',
			'media_play_pause',
			{ entity_id: PLAYER },
			undefined
		);
		expect(get(popup)).toBeNull();
	});

	it('seeks from a drag on the progress bar without opening the player', async () => {
		playing();
		const { container } = render(Card, {
			card: { id: 'music', type: 'media', entity: PLAYER }
		});
		const progress = container.querySelector<HTMLElement>('.progress')!;
		progress.getBoundingClientRect = () =>
			({ left: 0, width: 200, top: 0, height: 18, right: 200, bottom: 18 }) as DOMRect;
		const pointer = { isPrimary: true, pointerId: 1, button: 0, clientY: 9 };
		await fireEvent.pointerDown(progress, { ...pointer, clientX: 20 });
		await fireEvent.pointerMove(progress, { ...pointer, clientX: 100 });
		await fireEvent.pointerUp(progress, { ...pointer, clientX: 100 });
		await fireEvent.click(progress);
		expect(callService).toHaveBeenCalledWith(
			{},
			'media_player',
			'media_seek',
			{ entity_id: PLAYER, seek_position: 150 },
			undefined
		);
		expect(get(popup)).toBeNull();
	});

	it('keeps the tap area out of the tab order and away from screen readers', () => {
		playing();
		const { container } = render(Card, {
			card: { id: 'music', type: 'media', entity: PLAYER }
		});
		const hit = hitArea(container)!;
		expect(hit.tabIndex).toBe(-1);
		expect(hit.getAttribute('aria-hidden')).toBe('true');
		// the keyboard and a screen reader still see exactly the card's own controls
		expect(
			screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'))
		).toEqual(['Open controls', 'Pause']);
	});

	it('opens nothing from a tap in edit mode', async () => {
		playing();
		hearthEditMode.set(true);
		setCommandGate(() => false);
		const { container } = render(Card, {
			card: { id: 'music', type: 'media', entity: PLAYER }
		});
		await fireEvent.click(hitArea(container)!);
		expect(get(popup)).toBeNull();
	});

	it('opens the player for an idle speaker too, where the queue and speaker picker live', async () => {
		states.set({ [PLAYER]: hassEntity(PLAYER, 'idle', { friendly_name: 'Kitchen' }) });
		const { container } = render(Card, {
			card: { id: 'music', type: 'media', entity: PLAYER }
		});
		expect(screen.queryByRole('button', { name: 'Play' })).toBeNull();
		await fireEvent.click(hitArea(container)!);
		expect(get(popup)).toMatchObject({ kind: 'media', entity: PLAYER });
	});

	it('has nothing to open without an entity, or before the entity loads', async () => {
		states.set({});
		const { container, unmount } = render(Card, { card: { id: 'music', type: 'media' } });
		expect(hitArea(container)).toBeNull();
		unmount();

		const loading = render(Card, { card: { id: 'music', type: 'media', entity: PLAYER } });
		await fireEvent.click(hitArea(loading.container)!);
		// the sheet still opens on the entity id and falls back to a generic name
		expect(get(popup)).toMatchObject({ kind: 'media', entity: PLAYER, name: 'Media' });
	});
});
