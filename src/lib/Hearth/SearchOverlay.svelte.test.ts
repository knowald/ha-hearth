import { fireEvent, render, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callService, type Connection } from 'home-assistant-js-websocket';
import { connection, health } from '$lib/core/ha/connection';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import { popup } from './store';
import SearchOverlay from './SearchOverlay.svelte';
import overlaySource from './SearchOverlay.svelte?raw';
import { FOLD_WIDTH } from './breakpoints';

vi.mock('home-assistant-js-websocket', async (importOriginal) => ({
	...(await importOriginal<typeof import('home-assistant-js-websocket')>()),
	callService: vi.fn(() => Promise.resolve())
}));

function backdrop(container: HTMLElement) {
	return container.querySelector('.overlay') as HTMLElement;
}

describe('SearchOverlay', () => {
	it('stays open until the backdrop tap completes as a click', async () => {
		const onclose = vi.fn();
		const { container } = render(SearchOverlay, { onclose });
		await fireEvent.pointerDown(backdrop(container));
		expect(onclose).not.toHaveBeenCalled();
		await fireEvent.click(backdrop(container));
		expect(onclose).toHaveBeenCalledTimes(1);
	});

	it('ignores a press that starts in the panel and ends on the backdrop', async () => {
		const onclose = vi.fn();
		const { container } = render(SearchOverlay, { onclose });
		await fireEvent.pointerDown(container.querySelector('.panel') as HTMLElement);
		await fireEvent.click(backdrop(container));
		expect(onclose).not.toHaveBeenCalled();
	});

	it('ignores clicks inside the panel', async () => {
		const onclose = vi.fn();
		const { container } = render(SearchOverlay, { onclose });
		const panel = container.querySelector('.panel') as HTMLElement;
		await fireEvent.pointerDown(panel);
		await fireEvent.click(panel);
		expect(onclose).not.toHaveBeenCalled();
	});

	describe('scenes and scripts', () => {
		beforeEach(() => {
			connection.set({} as Connection);
			health.set('connected');
			states.set({
				'scene.movie': hassEntity('scene.movie', 'unknown', { friendly_name: 'Movie night' }),
				'script.goodnight': hassEntity('script.goodnight', 'off', { friendly_name: 'Good night' }),
				'switch.movie_lamp': hassEntity('switch.movie_lamp', 'off', { friendly_name: 'Movie lamp' })
			});
		});

		afterEach(() => {
			vi.clearAllMocks();
			popup.set(null);
			connection.set(undefined as unknown as Connection);
			health.set('lost');
		});

		async function search(text: string) {
			const onclose = vi.fn();
			render(SearchOverlay, { onclose });
			await fireEvent.input(screen.getByRole('textbox'), { target: { value: text } });
			return onclose;
		}

		it('runs the highlighted scene on Enter and closes', async () => {
			const onclose = await search('movie n');
			await fireEvent.keyDown(window, { key: 'Enter' });
			expect(callService).toHaveBeenCalledWith(
				{},
				'scene',
				'turn_on',
				{},
				{
					entity_id: 'scene.movie'
				}
			);
			expect(onclose).toHaveBeenCalledOnce();
		});

		it('runs a script from its Run button and still opens it on a row tap', async () => {
			await search('good');
			await fireEvent.click(screen.getByRole('button', { name: /^Good night/ }));
			expect(get(popup)).toMatchObject({ entity: 'script.goodnight' });
			expect(callService).not.toHaveBeenCalled();

			await fireEvent.click(screen.getByRole('button', { name: 'Run Good night' }));
			expect(callService).toHaveBeenCalledWith(
				{},
				'script',
				'turn_on',
				{},
				{
					entity_id: 'script.goodnight'
				}
			);
		});

		it('offers no Run button for other domains and opens them on Enter', async () => {
			await search('lamp');
			expect(screen.queryByRole('button', { name: /^Run / })).toBeNull();
			await fireEvent.keyDown(window, { key: 'Enter' });
			expect(get(popup)).toMatchObject({ entity: 'switch.movie_lamp' });
			expect(callService).not.toHaveBeenCalled();
		});
	});

	it('becomes a full-width sheet at the fold and sizes to the dynamic viewport', () => {
		const sheet = overlaySource.match(
			new RegExp(`@media \\(max-width: ${FOLD_WIDTH}px\\) \\{([\\s\\S]*?)\\n\\t\\}`)
		)?.[1];
		expect(sheet).toMatch(/\.panel \{[^}]*width: 100%;/);
		expect(sheet).toMatch(/--h-safe-top/);
		expect(overlaySource).not.toMatch(/\d+vh\b/);
		expect(overlaySource).toMatch(/var\(--h-dvh\)/);
	});
});
