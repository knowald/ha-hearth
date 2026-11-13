import { fireEvent, render, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import { closePopup, hearthEditMode, popup } from '../../store';
import type { GaugeCard } from './descriptor';
import Card from './Card.svelte';

function gauge(fields: Partial<GaugeCard> = {}): GaugeCard {
	return { id: 'gauge', type: 'gauge', entity: 'sensor.battery', ...fields };
}

function setBattery(state: string) {
	states.set({
		'sensor.battery': hassEntity('sensor.battery', state, {
			friendly_name: 'Phone battery',
			unit_of_measurement: '%'
		})
	});
}

describe('gauge card', () => {
	beforeEach(() => closePopup());
	afterEach(() => hearthEditMode.set(false));

	it('labels its button with the name, value and unit and opens the detail sheet', async () => {
		setBattery('54');
		render(Card, { card: gauge() });
		const button = screen.getByRole('button', { name: 'Phone battery, 54%' });
		expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
		expect(button.querySelector('.scale')?.textContent).toMatch(/0\s*100/);
		await fireEvent.click(button);
		expect(get(popup)).toMatchObject({ kind: 'detail', entity: 'sensor.battery' });
	});

	it('prefers the configured name and unit', () => {
		setBattery('2.43');
		render(Card, { card: gauge({ name: 'Power draw', unit: 'kW', min: 0, max: 6 }) });
		expect(screen.getByRole('button', { name: 'Power draw, 2.4 kW' })).toBeTruthy();
	});

	it('colors the arc by the segment the value falls in', () => {
		setBattery('18');
		const { container } = render(Card, {
			card: gauge({
				segments: [
					{ from: 0, color: 'bad' },
					{ from: 20, color: 'accent' },
					{ from: 50, color: 'good' }
				]
			})
		});
		const fill = container.querySelector<SVGPathElement>('.fill');
		expect(fill?.style.stroke).toBe('var(--h-bad-text)');
		expect(container.querySelectorAll('.band')).toHaveLength(3);
	});

	it('keeps the accent below the first segment and drops text that is no color', () => {
		setBattery('5');
		const { container } = render(Card, {
			card: gauge({
				segments: [
					{ from: 10, color: 'good' },
					{ from: 0, color: 'red; background: url(x)' }
				]
			})
		});
		const fill = container.querySelector<SVGPathElement>('.fill');
		expect(fill?.style.stroke).toBe('rgb(var(--h-accent-rgb))');
		expect(container.innerHTML).not.toContain('url(x)');
	});

	it('clamps the needle but shows the real reading', () => {
		setBattery('140');
		const { container } = render(Card, { card: gauge({ needle: true }) });
		const needle = container.querySelector<SVGGElement>('.needle');
		expect(needle?.style.transform).toBe('rotate(90deg)');
		expect(container.querySelector('.scale .reading')?.textContent).toBe('140%');
		expect(container.querySelector('.fill')).toBeNull();
	});

	it('shows the state text on an empty track when the entity is unavailable', () => {
		setBattery('unavailable');
		const { container } = render(Card, { card: gauge() });
		expect(screen.queryByRole('button')).toBeNull();
		expect(container.querySelector('.track.empty')).toBeTruthy();
		expect(container.querySelector('.state')?.textContent).toBe('Unavailable');
		expect(container.querySelector('.reading')?.textContent).toBe('-');
	});

	it('shows a missing entity and a non-numeric state as text', () => {
		states.set({});
		const { container, unmount } = render(Card, { card: gauge() });
		expect(container.querySelector('.state')?.textContent).toBe('Missing entity');
		unmount();
		setBattery('charging');
		const second = render(Card, { card: gauge() });
		expect(second.container.querySelector('.state')?.textContent).toBe('charging');
	});

	it('does nothing on a tap in edit mode', () => {
		setBattery('54');
		hearthEditMode.set(true);
		render(Card, { card: gauge() });
		expect(screen.queryByRole('button')).toBeNull();
	});
});
