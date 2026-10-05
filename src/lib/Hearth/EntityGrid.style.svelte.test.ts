import { act, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import { deviceName } from '$lib/core/app/device';
import type { EntityRef } from './config';
import EntityGrid from './EntityGrid.svelte';

const lock: EntityRef = {
	entity: 'lock.front',
	style: [
		{ conditions: [{ entity: 'lock.front', state: 'locked' }], color: 'good' },
		{
			conditions: [{ entity: 'lock.front', state: 'unlocked' }],
			color: '#e53935',
			icon: 'lock_open',
			class: 'unlocked alarm'
		},
		{ conditions: [{ device: 'hall' }], class: 'hall' }
	]
};

function slot(container: HTMLElement, entity: string) {
	return container.querySelector<HTMLElement>(`[data-entity="${entity}"]`)!.parentElement!;
}

describe('EntityGrid style rules', () => {
	afterEach(() => deviceName.set(''));

	it('wears the first rule that holds and lets go once none does', async () => {
		states.set({ 'lock.front': hassEntity('lock.front', 'unlocked') });
		const { container } = render(EntityGrid, { entities: [lock] });
		let element = slot(container, 'lock.front');
		expect(element.style.getPropertyValue('--tile-accent')).toBe('#e53935');
		expect(element.classList.contains('styled')).toBe(true);
		expect(element.classList.contains('unlocked')).toBe(true);
		expect(element.classList.contains('alarm')).toBe(true);
		expect(element.querySelector('.mi')?.textContent).toBe('lock_open');

		await act(() => states.set({ 'lock.front': hassEntity('lock.front', 'locked') }));
		element = slot(container, 'lock.front');
		expect(element.style.getPropertyValue('--tile-accent')).toBe('var(--h-good)');
		expect(element.classList.contains('unlocked')).toBe(false);

		await act(() => states.set({ 'lock.front': hassEntity('lock.front', 'jammed') }));
		element = slot(container, 'lock.front');
		expect(element.style.getPropertyValue('--tile-accent')).toBe('');
		expect(element.classList.contains('styled')).toBe(false);

		await act(() => deviceName.set('hall'));
		expect(slot(container, 'lock.front').classList.contains('hall')).toBe(true);
	});
});

describe('tile state hooks', () => {
	it('names the entity, its domain and its raw state on every tile kind', () => {
		states.set({
			'lock.front': hassEntity('lock.front', 'unlocked'),
			'light.desk': hassEntity('light.desk', 'on', { brightness: 128 }),
			'cover.blind': hassEntity('cover.blind', 'open', { current_position: 40 }),
			'sensor.temperature': hassEntity('sensor.temperature', '21.5')
		});
		const { container } = render(EntityGrid, {
			entities: [
				{ entity: 'lock.front' },
				{ entity: 'light.desk' },
				{ entity: 'cover.blind' },
				{ entity: 'sensor.temperature', display: 'stat' }
			]
		});
		const hooks = [...container.querySelectorAll<HTMLElement>('[data-entity]')].map((node) => [
			node.dataset.entity,
			node.dataset.domain,
			node.dataset.state
		]);
		expect(hooks).toEqual([
			['lock.front', 'lock', 'unlocked'],
			['light.desk', 'light', 'on'],
			['cover.blind', 'cover', 'open'],
			['sensor.temperature', 'sensor', '21.5']
		]);
	});
});
