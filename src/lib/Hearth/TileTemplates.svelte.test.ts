import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import type { TemplateRender } from '$lib/core/ha/templates';
import EntityGrid from './EntityGrid.svelte';

const listeners = new Map<string, (render: TemplateRender) => void>();
const watched: string[] = [];

// the lazy loader is replaced so templates register synchronously
vi.mock('./lazyTemplates', () => ({
	watchTemplateLazily: (template: string, listener: (render: TemplateRender) => void) => {
		watched.push(template);
		listeners.set(template, listener);
		listener({ status: 'loading' });
		return () => listeners.delete(template);
	}
}));

afterEach(() => {
	listeners.clear();
	watched.length = 0;
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
});
