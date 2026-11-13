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
	segments: [
		{ from: 0, color: 'Bad' },
		{ from: 4, color: 'orange' }
	]
};

function open(initial: GaugeCard | undefined = card) {
	const onchange = vi.fn();
	render(Editor, { initial, onchange });
	const last = () =>
		onchange.mock.lastCall?.[0] as {
			fields: Partial<GaugeCard>;
			valid?: boolean;
			reason?: string;
		};
	return { onchange, last };
}

const fromInputs = () => screen.getAllByLabelText(en.hearth_segment_from) as HTMLInputElement[];
const chips = (name: string) => screen.getAllByRole('button', { name, pressed: undefined });

describe('gauge card editor', () => {
	it('seeds the rows from the card and keeps a CSS color as typed', () => {
		const { last } = open();
		expect(fromInputs().map((input) => input.value)).toEqual(['0', '4']);
		expect(chips(en.hearth_bad)[0].getAttribute('aria-pressed')).toBe('true');
		expect(chips(en.hearth_custom)[1].getAttribute('aria-pressed')).toBe('true');
		expect((screen.getByRole('textbox', { name: en.hearth_color }) as HTMLInputElement).value).toBe(
			'orange'
		);
		expect(last()).toMatchObject({
			valid: true,
			fields: {
				entity: 'sensor.power',
				max: 6,
				segments: [
					{ from: 0, color: 'Bad' },
					{ from: 4, color: 'orange' }
				]
			}
		});
	});

	it('adds a row in the accent and stores it once it has a start', async () => {
		const { last } = open({ id: 'gauge', type: 'gauge', entity: 'sensor.power' });
		expect(last().fields.segments).toBeUndefined();
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_add_segment }));
		expect(chips(en.hearth_accent)[0].getAttribute('aria-pressed')).toBe('true');
		// a row without a start is left out but does not block Done
		expect(last()).toMatchObject({ valid: true, fields: { segments: undefined } });
		expect(screen.getByText(en.hearth_segment_unfinished_removed)).toBeTruthy();
		await fireEvent.input(fromInputs()[0], { target: { value: '20' } });
		expect(last()).toMatchObject({
			valid: true,
			fields: { segments: [{ from: 20, color: 'accent' }] }
		});
	});

	it('emits a draft for a segment-only change', async () => {
		const { last } = open();
		await fireEvent.click(chips(en.hearth_good)[0]);
		expect(last().fields.segments).toEqual([
			{ from: 0, color: 'good' },
			{ from: 4, color: 'orange' }
		]);
	});

	it('removes a row and keeps the next row as it was', async () => {
		const { last } = open();
		await fireEvent.click(screen.getAllByRole('button', { name: en.hearth_remove_segment })[0]);
		expect(fromInputs().map((input) => input.value)).toEqual(['4']);
		expect(chips(en.hearth_custom)[0].getAttribute('aria-pressed')).toBe('true');
		expect(last().fields.segments).toEqual([{ from: 4, color: 'orange' }]);
	});

	it('blocks Done on a start that is not a number', async () => {
		const { last } = open();
		await fireEvent.input(fromInputs()[0], { target: { value: 'low' } });
		expect(last().valid).toBe(false);
		expect(screen.getByText(en.hearth_segment_from_invalid)).toBeTruthy();
	});

	it('blocks Done on a color styleColor rejects', async () => {
		const { last } = open();
		await fireEvent.input(screen.getByRole('textbox', { name: en.hearth_color }), {
			target: { value: 'red; background: url(x)' }
		});
		expect(last().valid).toBe(false);
		expect(screen.getByText(en.hearth_style_color_invalid)).toBeTruthy();
	});

	it('opens an empty custom color from a role', async () => {
		const { last } = open();
		await fireEvent.click(chips(en.hearth_custom)[0]);
		expect(chips(en.hearth_custom)[0].getAttribute('aria-pressed')).toBe('true');
		expect(screen.getAllByRole('textbox', { name: en.hearth_color })).toHaveLength(2);
		// a blank color is unfinished, not wrong
		expect(last()).toMatchObject({ valid: true, fields: { segments: [{ from: 4 }] } });
	});

	it('stores the range and the needle', async () => {
		const { last } = open();
		await fireEvent.click(screen.getByLabelText(en.hearth_needle));
		expect(last().fields).toMatchObject({ entity: 'sensor.power', max: 6, needle: true });
	});

	it('still blocks Done while the minimum is not below the maximum', async () => {
		const { last } = open();
		await fireEvent.input(screen.getByLabelText(en.hearth_minimum), { target: { value: '8' } });
		expect(last().valid).toBe(false);
		expect(screen.getAllByText(en.hearth_gauge_min_below_max).length).toBeGreaterThan(0);
		await fireEvent.input(screen.getByLabelText(en.hearth_minimum), { target: { value: '1' } });
		expect(last()).toMatchObject({ valid: true, fields: { min: 1, max: 6 } });
	});

	it('reports the missing entity as the reason', () => {
		const { last } = open({ id: 'gauge', type: 'gauge' });
		expect(last()).toMatchObject({ valid: false, reason: expect.stringContaining(en.entity) });
	});
});
