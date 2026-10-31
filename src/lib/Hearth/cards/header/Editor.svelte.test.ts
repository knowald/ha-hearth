import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { english as en } from '$lib/core/i18n/testing';
import type { HeaderCard } from './descriptor';
import Editor from './Editor.svelte';

const card: HeaderCard = {
	id: 'header',
	type: 'header',
	title: 'Upstairs',
	temp_entity: 'sensor.temp'
};

describe('header card editor', () => {
	it('lists the older temperature field as a reading and keeps it while unchanged', () => {
		const onchange = vi.fn();
		render(Editor, { initial: card, onchange });
		expect((screen.getByLabelText(en.entity) as HTMLInputElement).value).toBe('sensor.temp');
		expect(onchange.mock.lastCall?.[0].fields).toMatchObject({
			stats: undefined,
			temp_entity: 'sensor.temp'
		});
	});

	it('reports a labeled reading as the list', async () => {
		const onchange = vi.fn();
		render(Editor, { initial: card, onchange });
		await fireEvent.input(screen.getByLabelText(en.hearth_label_optional), {
			target: { value: 'Inside' }
		});
		expect(onchange.mock.lastCall?.[0].fields).toMatchObject({
			stats: [{ entity: 'sensor.temp', name: 'Inside' }],
			temp_entity: undefined
		});
	});
});
