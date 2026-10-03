import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import en from '../../../../static/translations/en.json';
import EntityPicker from './EntityPicker.svelte';

function open() {
	const onselect = vi.fn();
	const onclose = vi.fn();
	render(EntityPicker, { onselect, onclose });
	const search = screen.getByRole('combobox', { name: en.hearth_search_entities });
	return { onselect, onclose, search };
}

function activeOption(search: HTMLElement) {
	return document.getElementById(search.getAttribute('aria-activedescendant')!);
}

describe('EntityPicker keyboard', () => {
	beforeEach(() => {
		states.set({
			'light.desk': hassEntity('light.desk', 'on', { friendly_name: 'Desk lamp' }),
			'light.shelf': hassEntity('light.shelf', 'off', { friendly_name: 'Shelf light' }),
			'switch.fan': hassEntity('switch.fan', 'on', { friendly_name: 'Fan' })
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('highlights the first match and picks it on Enter', async () => {
		const { onselect, onclose, search } = open();
		expect(activeOption(search)?.textContent).toContain('Desk lamp');
		await fireEvent.keyDown(search, { key: 'Enter' });
		expect(onselect).toHaveBeenCalledWith('light.desk');
		expect(onclose).toHaveBeenCalled();
	});

	it('moves the highlight with the arrow keys, stopping at either end', async () => {
		const { onselect, search } = open();
		await fireEvent.keyDown(search, { key: 'ArrowUp' });
		expect(activeOption(search)?.textContent).toContain('Desk lamp');
		await fireEvent.keyDown(search, { key: 'ArrowDown' });
		await fireEvent.keyDown(search, { key: 'ArrowDown' });
		await fireEvent.keyDown(search, { key: 'ArrowDown' });
		const option = activeOption(search)!;
		expect(option.textContent).toContain('Shelf light');
		expect(option.getAttribute('aria-selected')).toBe('true');
		expect(screen.getAllByRole('option', { selected: true })).toHaveLength(1);
		await fireEvent.keyDown(search, { key: 'Enter' });
		expect(onselect).toHaveBeenCalledWith('light.shelf');
	});

	it('returns the highlight to the top when the query changes', async () => {
		const { search } = open();
		await fireEvent.keyDown(search, { key: 'ArrowDown' });
		await fireEvent.input(search, { target: { value: 'l' } });
		expect(activeOption(search)?.textContent).toContain('Desk lamp');
	});

	it('ignores Enter when nothing matches', async () => {
		const { onselect, search } = open();
		await fireEvent.input(search, { target: { value: 'nothing here' } });
		expect(search.getAttribute('aria-activedescendant')).toBeNull();
		await fireEvent.keyDown(search, { key: 'Enter' });
		expect(onselect).not.toHaveBeenCalled();
	});

	it('focuses the search only where a fine pointer is the primary input', () => {
		vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(pointer: fine)' }));
		const { search } = open();
		expect(document.activeElement).toBe(search);
	});

	it('focuses the dialog instead on a touch screen', () => {
		vi.stubGlobal('matchMedia', () => ({ matches: false }));
		open();
		expect(document.activeElement).toBe(
			screen.getByRole('dialog', { name: en.hearth_choose_entity })
		);
	});
});
