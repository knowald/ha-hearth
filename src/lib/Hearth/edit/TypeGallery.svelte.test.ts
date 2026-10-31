import { fireEvent, render, screen, within } from '@testing-library/svelte';
import type { HassEntities } from 'home-assistant-js-websocket';
import { tick } from 'svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { english as en } from '$lib/core/i18n/testing';
import { states } from '$lib/core/ha/entities';
import { DEFAULT_HEARTH_CONFIG, type HearthConfig } from '../config';
import { editor, hearthConfig } from '../store';
import CardEditSheet from './CardEditSheet.svelte';
import RailWidgetEditSheet from './RailWidgetEditSheet.svelte';

function seed() {
	const config: HearthConfig = structuredClone(DEFAULT_HEARTH_CONFIG);
	config.rooms = [{ id: 'den', name: 'Den', icon: 'sofa', cards: [[]] }];
	config.rail = [];
	hearthConfig.set(config);
	const entity = (entity_id: string, state: string) => ({
		entity_id,
		state,
		attributes: {},
		last_changed: '',
		last_updated: '',
		context: { id: '', parent_id: null, user_id: null }
	});
	states.set({
		'climate.hall': entity('climate.hall', 'heat'),
		'light.porch': entity('light.porch', 'on')
	} as HassEntities);
}

const cards = () => get(hearthConfig).rooms[0].cards![0];
const option = (name: string) => screen.getByRole('option', { name: new RegExp(`^${name}\\b`) });
const done = () => screen.queryByRole('button', { name: en.done });

async function settle() {
	await vi.dynamicImportSettled();
	await tick();
}

describe('the add-card gallery', () => {
	beforeEach(seed);
	afterEach(() => {
		editor.set(null);
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
		states.set(undefined as never);
	});

	it('groups the types and offers one action, for the page', () => {
		render(CardEditSheet, { roomId: 'den', id: null, column: 0 });
		expect(screen.getByText('to Den')).toBeTruthy();
		expect(done()).toBeNull();
		for (const key of [
			'hearth_card_group_devices',
			'hearth_card_group_information',
			'hearth_card_group_media'
		] as const) {
			expect(screen.getByRole('group', { name: en[key] })).toBeTruthy();
		}
		const devices = screen.getByRole('group', { name: en.hearth_card_group_devices });
		expect(within(devices).getByRole('option', { name: /^Climate\b/ })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Add to Den' })).toBeTruthy();
		expect(screen.getByRole('button', { name: en.hearth_paste_yaml })).toBeTruthy();
	});

	it('selects on a tap and adds the previewed card from the action', async () => {
		render(CardEditSheet, { roomId: 'den', id: null, column: 0 });
		await fireEvent.click(option('Climate'));
		// a tap only selects: the gallery stays and the preview follows
		expect(option('Climate').getAttribute('aria-selected')).toBe('true');
		expect(screen.getByText(en.hearth_add_card_next_adjust)).toBeTruthy();

		await fireEvent.click(screen.getByRole('button', { name: 'Add to Den' }));
		await settle();
		expect(screen.getByRole('button', { name: /Card type/ }).textContent).toContain('Climate');
		expect(done()).toBeTruthy();
		await vi.waitFor(() => expect(done()!.hasAttribute('disabled')).toBe(false));
		await fireEvent.click(done()!);
		expect(cards()).toEqual([expect.objectContaining({ type: 'climate', entity: 'climate.hall' })]);
	});

	it('goes on from Enter or a double tap on a type', async () => {
		render(CardEditSheet, { roomId: 'den', id: null, column: 0 });
		await fireEvent.keyDown(option('Entities'), { key: 'Enter' });
		expect(screen.getByRole('button', { name: /Card type/ }).textContent).toContain('Entities');

		await fireEvent.click(screen.getByRole('button', { name: /Card type/ }));
		await fireEvent.dblClick(option('Header'));
		expect(screen.getByRole('button', { name: /Card type/ }).textContent).toContain('Header');
	});

	it('says what is left to do when Home Assistant has nothing to start from', async () => {
		render(CardEditSheet, { roomId: 'den', id: null, column: 0 });
		await fireEvent.click(option('Vacuum'));
		expect(screen.getByText(en.hearth_add_card_next_configure)).toBeTruthy();
	});

	it('keeps the one-tap picker when an existing card changes type', async () => {
		hearthConfig.update((config) => {
			config.rooms[0].cards = [[{ id: 'lamps', type: 'entities', entities: [] }] as never];
			return config;
		});
		render(CardEditSheet, { roomId: 'den', id: 'lamps' });
		expect(screen.queryByText('to Den')).toBeNull();
		await fireEvent.click(screen.getByRole('button', { name: /Card type/ }));
		expect(screen.queryByRole('button', { name: 'Add to Den' })).toBeNull();
		await fireEvent.click(option('Climate'));
		expect(screen.getByRole('button', { name: /Card type/ }).textContent).toContain('Climate');
	});

	it('leaves Done off the add-widget gallery until a type is picked', async () => {
		render(RailWidgetEditSheet, { index: null });
		expect(done()).toBeNull();
		await fireEvent.click(option('Clock'));
		expect(done()).toBeTruthy();
	});
});
