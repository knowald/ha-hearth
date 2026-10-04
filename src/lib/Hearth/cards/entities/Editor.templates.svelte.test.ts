import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../../../static/translations/en.json';
import type { EntitiesCard } from './descriptor';
import Editor from './Editor.svelte';

function renderEditor(initial: Partial<EntitiesCard>) {
	const onchange = vi.fn();
	render(Editor, {
		initial: { id: 'card', type: 'entities', entities: [], ...initial } as EntitiesCard,
		onchange
	});
	return () => onchange.mock.lastCall?.[0] as { fields: EntitiesCard; valid?: boolean };
}

describe('entities editor tile templates', () => {
	it('keeps stored templates verbatim, stores typed ones and drops cleared ones', async () => {
		const last = renderEditor({
			entities: [{ entity: 'switch.fan', name_template: "Fan {{ states('switch.fan') }}" }]
		});
		expect(last().fields.entities[0]).toMatchObject({
			name_template: "Fan {{ states('switch.fan') }}",
			state_template: undefined
		});

		await fireEvent.click(screen.getByRole('button', { name: /switch\.fan/ }));
		await fireEvent.input(screen.getByLabelText(en.hearth_state_template_optional), {
			target: { value: "{{ states('sensor.power') }} W" }
		});
		await fireEvent.input(screen.getByLabelText(en.hearth_name_template_optional), {
			target: { value: '  ' }
		});
		expect(last().fields.entities[0]).toMatchObject({
			name_template: undefined,
			state_template: "{{ states('sensor.power') }} W"
		});
		expect(last().valid).toBe(true);
	});
});
