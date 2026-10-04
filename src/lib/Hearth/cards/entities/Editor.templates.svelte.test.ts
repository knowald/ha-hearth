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
	it('keeps stored templates verbatim, newlines included, and offers code fields for them', async () => {
		const nameTemplate = "{% if is_state('switch.fan', 'on') %}\nFan on\n{% endif %}";
		const last = renderEditor({
			entities: [{ entity: 'switch.fan', name_template: nameTemplate }]
		});
		expect(last().fields.entities[0]).toMatchObject({
			name_template: nameTemplate,
			state_template: undefined
		});
		expect(last().valid).toBe(true);

		await fireEvent.click(screen.getByRole('button', { name: /switch\.fan/ }));
		// the code editor loads on demand
		expect(await screen.findByLabelText(en.hearth_name_template_optional)).toBeTruthy();
		expect(await screen.findByLabelText(en.hearth_state_template_optional)).toBeTruthy();
		expect(last().fields.entities[0].name_template).toBe(nameTemplate);
	});
});
