import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { english as en } from '$lib/core/i18n/testing';
import type { GaugeCard } from './descriptor';
import Editor from './Editor.svelte';

const card: GaugeCard = {
	id: 'gauge',
	type: 'gauge',
	entity: 'sensor.power',
	max: 6,
	segments: [{ from: 4, color: 'bad' }]
};

describe('gauge card editor', () => {
	it('stores the range and the needle and leaves segments to the YAML', async () => {
		const onchange = vi.fn();
		render(Editor, { initial: card, onchange });
		await fireEvent.click(screen.getByLabelText(en.hearth_needle));
		const fields = onchange.mock.lastCall?.[0].fields;
		expect(fields).toMatchObject({ entity: 'sensor.power', max: 6, needle: true });
		expect(fields).not.toHaveProperty('segments');
	});

	it('blocks Done while the minimum is not below the maximum', async () => {
		const onchange = vi.fn();
		render(Editor, { initial: card, onchange });
		await fireEvent.input(screen.getByLabelText(en.hearth_minimum), { target: { value: '8' } });
		expect(onchange.mock.lastCall?.[0]).toMatchObject({ valid: false });
		expect(screen.getAllByText(en.hearth_gauge_min_below_max).length).toBeGreaterThan(0);
		await fireEvent.input(screen.getByLabelText(en.hearth_minimum), { target: { value: '1' } });
		expect(onchange.mock.lastCall?.[0]).toMatchObject({
			valid: true,
			fields: { min: 1, max: 6 }
		});
	});
});
