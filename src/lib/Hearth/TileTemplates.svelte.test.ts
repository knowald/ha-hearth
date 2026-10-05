import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import type { TemplateRender } from '$lib/core/ha/templates';
import { controlOverrides, pendingEntities } from '$lib/core/ha/commands';
import { hearthEditMode } from './store';
import EntityGrid from './EntityGrid.svelte';

const listeners = new Map<string, (render: TemplateRender) => void>();
const watched: string[] = [];
const delays: number[] = [];

// the lazy loader is replaced so templates register synchronously
vi.mock('./lazyTemplates', () => ({
	EDIT_SETTLE_MS: 400,
	watchTemplateLazily: (
		template: string,
		listener: (render: TemplateRender) => void,
		delay = 0
	) => {
		watched.push(template);
		delays.push(delay);
		listeners.set(template, listener);
		listener({ status: 'loading' });
		return () => listeners.delete(template);
	}
}));

afterEach(() => {
	listeners.clear();
	watched.length = 0;
	delays.length = 0;
	hearthEditMode.set(false);
	pendingEntities.set({});
	controlOverrides.set({});
});

async function push(template: string, render: TemplateRender) {
	listeners.get(template)!(render);
	await tick();
}

function grid(style: 'tile' | 'stat' = 'tile') {
	states.set({
		'switch.fan': hassEntity('switch.fan', 'on', { friendly_name: 'Ceiling fan' }),
		'sensor.power': hassEntity('sensor.power', '312', { unit_of_measurement: 'W' })
	});
	return render(EntityGrid, {
		style,
		entities: [
			{ entity: 'switch.fan', name_template: 'NAME', state_template: 'STATE' },
			{ entity: 'sensor.power', display: 'stat', state_template: 'STAT' }
		]
	});
}

describe('templated tile text', () => {
	it('shows the normal name and state until the templates render', async () => {
		const { container } = grid();
		const tile = container.querySelector('.tile')!;
		expect(tile.querySelector('.name')?.textContent).toBe('Ceiling fan');
		expect(tile.querySelector('.state')?.textContent?.trim()).not.toBe('');

		await push('NAME', { status: 'ready', result: ' Fan is on\n' });
		await push('STATE', { status: 'ready', result: '2 speeds' });
		expect(tile.querySelector('.name')?.textContent).toBe('Fan is on');
		expect(tile.querySelector('.state')?.textContent?.trim()).toBe('2 speeds');
	});

	it('falls back to the normal text when a template fails or renders blank', async () => {
		const { container } = grid();
		const tile = container.querySelector('.tile')!;
		await push('NAME', { status: 'ready', result: 'Fan is on' });
		await push('NAME', { status: 'error', error: 'UndefinedError' });
		expect(tile.querySelector('.name')?.textContent).toBe('Ceiling fan');
		await push('NAME', { status: 'ready', result: '  ' });
		expect(tile.querySelector('.name')?.textContent).toBe('Ceiling fan');
	});

	it('replaces a stat reading and its unit', async () => {
		grid();
		expect(screen.getByText('312')).toBeTruthy();
		await push('STAT', { status: 'ready', result: 'High' });
		const value = document.querySelector('.stat .stat-value')!;
		expect(value.textContent?.trim()).toBe('High');
		expect(value.querySelector('.stat-unit')).toBeNull();
	});

	it('subscribes only to the templates a ref sets', () => {
		states.set({});
		render(EntityGrid, { entities: [{ entity: 'switch.fan' }] });
		expect(watched).toEqual([]);
	});

	it('gives way to the availability text and to a change in flight', async () => {
		states.set({
			'light.desk': hassEntity('light.desk', 'on', {
				friendly_name: 'Desk',
				brightness: 128,
				supported_color_modes: ['brightness']
			}),
			'cover.blind': hassEntity('cover.blind', 'unavailable', { friendly_name: 'Blind' })
		});
		const { container } = render(EntityGrid, {
			entities: [
				{ entity: 'light.desk', state_template: 'LIGHT' },
				{ entity: 'cover.blind', state_template: 'BLIND' }
			]
		});
		await push('LIGHT', { status: 'ready', result: 'Reading light' });
		await push('BLIND', { status: 'ready', result: 'Half way' });
		const [light, blind] = [...container.querySelectorAll('.state')];
		expect(light.textContent?.trim()).toBe('Reading light');
		expect(blind.textContent?.trim()).not.toBe('Half way');

		controlOverrides.set({ 'light:light.desk': 80 });
		await tick();
		expect(light.textContent?.trim()).not.toBe('Reading light');
		controlOverrides.set({});
		pendingEntities.set({ 'light.desk': true });
		await tick();
		expect(light.textContent?.trim()).not.toBe('Reading light');
		pendingEntities.set({});
		await tick();
		expect(light.textContent?.trim()).toBe('Reading light');
	});

	it('waits for typing to pause before following an edited template in edit mode', async () => {
		states.set({ 'switch.fan': hassEntity('switch.fan', 'on') });
		hearthEditMode.set(true);
		const { rerender } = render(EntityGrid, {
			entities: [{ entity: 'switch.fan', name_template: 'A' }]
		});
		await rerender({ entities: [{ entity: 'switch.fan', name_template: 'AB' }] });
		expect(watched).toEqual(['A', 'AB']);
		expect(delays).toEqual([0, 400]);
	});
});
