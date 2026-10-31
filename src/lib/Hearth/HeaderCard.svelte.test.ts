import { act, fireEvent, render, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cancelEdit, enterEditMode, hearthEditMode } from './store';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import { english as en } from '$lib/core/i18n/testing';
import HeaderCard from './HeaderCard.svelte';

describe('HeaderCard', () => {
	afterEach(() => {
		if (get(hearthEditMode)) cancelEdit();
	});

	it('is a control only while editing with something to edit', async () => {
		const onedit = vi.fn();
		const { container } = render(HeaderCard, { title: 'Kitchen', onedit });
		expect(screen.queryByRole('button')).toBeNull();
		expect(container.querySelector('[tabindex]')).toBeNull();

		await act(() => enterEditMode());
		await fireEvent.click(screen.getByRole('button'));
		expect(onedit).toHaveBeenCalledTimes(1);
	});

	it('draws an uploaded background image as a banner', () => {
		const file = `${'a'.repeat(32)}.webp`;
		const { container } = render(HeaderCard, {
			title: 'Kitchen',
			backgroundImage: `hearth-images/${file}`
		});
		expect(container.querySelector('.header.banner')).not.toBeNull();
		expect(container.querySelector('img.backdrop')?.getAttribute('src')).toBe(
			`${location.origin}/_api/hearth_images/${file}`
		);
	});

	it('drops the banner when the image fails to load', async () => {
		const { container } = render(HeaderCard, {
			title: 'Kitchen',
			backgroundImage: 'https://example.com/missing.jpg'
		});
		await fireEvent.error(container.querySelector('img.backdrop')!);
		expect(container.querySelector('.banner')).toBeNull();
		expect(container.querySelector('img.backdrop')).toBeNull();
	});

	it('shows its readings in order with their labels', () => {
		states.set({
			'sensor.temp': hassEntity('sensor.temp', '21.46', { unit_of_measurement: '\u00b0C' }),
			'sensor.humidity': hassEntity('sensor.humidity', '47.4', {
				device_class: 'humidity',
				unit_of_measurement: '%'
			}),
			'sensor.co2': hassEntity('sensor.co2', '612', {
				friendly_name: 'Living CO2',
				unit_of_measurement: 'ppm'
			}),
			'lock.door': hassEntity('lock.door', 'locked', { friendly_name: 'Front door' })
		});
		const { container } = render(HeaderCard, {
			title: 'Kitchen',
			stats: [
				{ entity: 'sensor.temp', kind: 'temperature' },
				{ entity: 'sensor.humidity' },
				{ entity: 'sensor.co2' },
				{ entity: 'lock.door', name: 'Door' },
				{ entity: 'sensor.gone' }
			]
		});
		const shown = [...container.querySelectorAll('.stat')].map((stat) => [
			stat.querySelector('.stat-value')?.textContent,
			stat.querySelector('.stat-label')?.textContent
		]);
		expect(shown).toEqual([
			['21.5\u00b0', en.hearth_temp],
			['47%', en.hearth_humidity],
			['612 ppm', 'Living CO2'],
			['locked', 'Door'],
			['-', 'sensor.gone']
		]);
	});

	it('leaves out the readings row without readings', () => {
		const { container } = render(HeaderCard, { title: 'Kitchen' });
		expect(container.querySelector('.stats')).toBeNull();
	});

	it('stays plain content in edit mode without an edit handler', async () => {
		render(HeaderCard, { title: 'Kitchen' });
		await act(() => enterEditMode());
		expect(screen.queryByRole('button')).toBeNull();
	});
});
