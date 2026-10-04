import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import type { RegistrySnapshot } from '$lib/core/ha/registry';
import en from '../../../../static/translations/en.json';
import { forgetEntityPlaces } from './entityDirectory';

const fetchRegistry = vi.fn<() => Promise<RegistrySnapshot>>();
vi.mock('$lib/core/ha/registry', () => ({ fetchRegistry: () => fetchRegistry() }));

const { default: EntityPicker } = await import('./EntityPicker.svelte');

function open(props: Record<string, unknown> = {}) {
	const onselect = vi.fn();
	const onclose = vi.fn();
	render(EntityPicker, { onselect, onclose, ...props });
	const search = screen.getByRole('combobox', { name: en.hearth_search_entities });
	return { onselect, onclose, search };
}

function activeOption(search: HTMLElement) {
	return document.getElementById(search.getAttribute('aria-activedescendant')!);
}

beforeEach(() => {
	localStorage.clear();
	forgetEntityPlaces();
	fetchRegistry.mockReset();
	fetchRegistry.mockRejectedValue(new Error('Not connected to Home Assistant'));
});

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

	it('leaves an Enter that ends an input method composition alone', async () => {
		const { onselect, search } = open();
		await fireEvent.keyDown(search, { key: 'Enter', isComposing: true });
		expect(onselect).not.toHaveBeenCalled();
	});

	it('moves the highlight to the row under the pointer', async () => {
		const { search } = open();
		await fireEvent.pointerMove(screen.getByRole('option', { name: /Fan/ }));
		expect(activeOption(search)?.textContent).toContain('Fan');
		expect(screen.getAllByRole('option', { selected: true })).toHaveLength(1);
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

function optionNames() {
	return screen.getAllByRole('option').map((option) => option.textContent ?? '');
}

describe('EntityPicker v2', () => {
	beforeEach(() => {
		states.set({
			'light.desk': hassEntity('light.desk', 'on', { friendly_name: 'Desk lamp' }),
			'light.shelf': hassEntity('light.shelf', 'off', { friendly_name: 'Shelf light' }),
			'switch.plug': hassEntity('switch.plug', 'on', { friendly_name: 'Plug' }),
			'sensor.temperature': hassEntity('sensor.temperature', '21.5', {
				friendly_name: 'Temperature',
				device_class: 'temperature',
				unit_of_measurement: 'C'
			}),
			'sensor.humidity': hassEntity('sensor.humidity', '40', {
				friendly_name: 'Humidity',
				device_class: 'humidity',
				unit_of_measurement: '%'
			})
		});
		fetchRegistry.mockResolvedValue({
			floors: [],
			areas: [
				{ area_id: 'office', name: 'Office' },
				{ area_id: 'kitchen', name: 'Kitchen' }
			],
			devices: [{ id: 'hub', area_id: 'kitchen', name: 'Smart hub' }],
			entities: [
				{
					entity_id: 'light.desk',
					area_id: 'office',
					device_id: null,
					disabled_by: null,
					hidden_by: null
				},
				{
					entity_id: 'switch.plug',
					area_id: null,
					device_id: 'hub',
					disabled_by: null,
					hidden_by: null
				},
				{
					entity_id: 'light.shelf',
					area_id: 'kitchen',
					device_id: null,
					disabled_by: null,
					hidden_by: null
				}
			]
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('finds an entity by its area or device name and shows the area', async () => {
		const { search } = open();
		await screen.findAllByText('Office');
		await fireEvent.input(search, { target: { value: 'office' } });
		expect(optionNames()).toEqual([expect.stringContaining('Desk lamp')]);
		expect(screen.getByRole('option').textContent).toContain('Office');
		await fireEvent.input(search, { target: { value: 'smart hub' } });
		expect(optionNames()).toEqual([expect.stringContaining('Plug')]);
	});

	it('fetches the registry once across pickers', async () => {
		open();
		await screen.findAllByText('Office');
		cleanup();
		open();
		await screen.findAllByText('Office');
		expect(fetchRegistry).toHaveBeenCalledTimes(1);
	});

	it('narrows the list to an area from its chip', async () => {
		open();
		const chip = await screen.findByRole('button', { name: 'Kitchen' });
		await fireEvent.click(chip);
		expect(chip.getAttribute('aria-pressed')).toBe('true');
		expect(optionNames()).toEqual([
			expect.stringContaining('Plug'),
			expect.stringContaining('Shelf light')
		]);
		await fireEvent.click(chip);
		expect(optionNames()).toHaveLength(5);
	});

	it('still searches names without a connection', async () => {
		fetchRegistry.mockRejectedValue(new Error('Not connected to Home Assistant'));
		const { search } = open();
		await fireEvent.input(search, { target: { value: 'shelf' } });
		expect(optionNames()).toEqual([expect.stringContaining('Shelf light')]);
		expect(screen.queryByRole('group', { name: en.hearth_filter_by_area })).toBeNull();
	});

	it('limits the list to a device class and shows the state with its unit', () => {
		open({ domains: ['sensor'], deviceClass: 'temperature' });
		expect(optionNames()).toEqual([expect.stringContaining('Temperature')]);
		expect(screen.getByRole('option').textContent).toContain('21.5 C');
	});

	it('picks several entities and hands them over in order with one confirm', async () => {
		const onselectmany = vi.fn();
		const { onselect, onclose, search } = open({ multiple: true, onselectmany });
		const confirm = screen.getByRole('button', { name: en.hearth_add_picked_entities });
		expect(confirm.hasAttribute('disabled')).toBe(true);
		expect(screen.getByRole('listbox').getAttribute('aria-multiselectable')).toBe('true');

		await fireEvent.click(screen.getByRole('option', { name: /Shelf light/ }));
		// Enter toggles the highlighted row rather than closing
		await fireEvent.keyDown(search, { key: 'Enter' });
		await fireEvent.click(screen.getByRole('option', { name: /Plug/ }));
		await fireEvent.click(screen.getByRole('option', { name: /Plug/ }));
		expect(onclose).not.toHaveBeenCalled();
		expect(screen.getAllByRole('option', { selected: true })).toHaveLength(2);
		expect(screen.getByRole('status').textContent).toContain('2');

		await fireEvent.click(confirm);
		expect(onselectmany).toHaveBeenCalledWith(['light.shelf', 'light.desk']);
		expect(onselect).not.toHaveBeenCalled();
		expect(onclose).toHaveBeenCalled();
	});

	it('lists recent picks first while the search is empty', async () => {
		const first = open();
		await fireEvent.click(screen.getByRole('option', { name: /Plug/ }));
		expect(first.onselect).toHaveBeenCalledWith('switch.plug');
		cleanup();

		const { search } = open();
		expect(optionNames()[0]).toContain('Plug');
		expect(optionNames()[0]).toContain(en.hearth_recently_picked);
		await fireEvent.input(search, { target: { value: 'l' } });
		expect(optionNames()[0]).toContain('Desk lamp');
	});

	it('works without recents when storage throws', async () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('blocked');
		});
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('blocked');
		});
		const { onselect } = open();
		expect(optionNames()[0]).toContain('Desk lamp');
		await fireEvent.click(screen.getByRole('option', { name: /Plug/ }));
		expect(onselect).toHaveBeenCalledWith('switch.plug');
	});
});
