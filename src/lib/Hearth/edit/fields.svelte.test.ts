import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import en from '../../../../static/translations/en.json';
import CheckField from './CheckField.svelte';
import EntityField from './EntityField.svelte';
import IconField from './IconField.svelte';
import SelectField from './SelectField.svelte';
import TextField from './TextField.svelte';

const OPTIONS = [{ value: 'a', label: 'A' }];

// the three fields share these props; their other props differ
function renderField(Field: unknown, props: Record<string, unknown>) {
	return render(Field as typeof TextField, props as never);
}

describe.each([
	['TextField', TextField, 'textbox', {}],
	['SelectField', SelectField, 'combobox', { options: OPTIONS }],
	['EntityField', EntityField, 'combobox', {}],
	['CheckField', CheckField, 'switch', {}]
] as const)('%s messages', (_name, Field, role, extra) => {
	it('describes the control with its hint, outside the accessible name', () => {
		renderField(Field, { label: 'Night states', hint: 'Comma separated', ...extra });
		const control = screen.getByRole(role, { name: 'Night states' });
		const hint = screen.getByText('Comma separated');
		expect(control.getAttribute('aria-describedby')).toBe(hint.id);
		expect(hint.classList.contains('field-hint')).toBe(true);
		expect(control.getAttribute('aria-invalid')).toBeNull();
	});

	it('announces an error and marks the control invalid', () => {
		renderField(Field, { label: 'Height', error: 'Must be a number', ...extra });
		const control = screen.getByRole(role, { name: 'Height' });
		const alert = screen.getByRole('alert');
		expect(alert.textContent).toBe('Must be a number');
		expect(control.getAttribute('aria-describedby')).toBe(alert.id);
		expect(control.getAttribute('aria-invalid')).toBe('true');
	});

	it('renders no messages by default', () => {
		renderField(Field, { label: 'Name', ...extra });
		expect(screen.getByRole(role, { name: 'Name' }).getAttribute('aria-describedby')).toBeNull();
		expect(screen.queryByRole('alert')).toBeNull();
	});
});

describe.each([
	['TextField', TextField, 'textbox', {}],
	['EntityField', EntityField, 'combobox', {}]
] as const)('%s required', (_name, Field, role, extra) => {
	it('marks the label and tells assistive tech, outside the accessible name', () => {
		const { container } = renderField(Field, { label: 'Entity', required: true, ...extra });
		const control = screen.getByRole(role, { name: 'Entity' });
		expect(control.getAttribute('aria-required')).toBe('true');
		expect(container.querySelector('.field-label.field-required')).not.toBeNull();
	});

	it('leaves an optional field unmarked', () => {
		const { container } = renderField(Field, { label: 'Entity', ...extra });
		expect(screen.getByRole(role, { name: 'Entity' }).getAttribute('aria-required')).toBeNull();
		expect(container.querySelector('.field-required')).toBeNull();
	});
});

describe('CheckField', () => {
	it('toggles from the switch and from its visible label', async () => {
		const onchange = vi.fn();
		render(CheckField, { label: 'Live stream', checked: false, onchange });
		const control = screen.getByRole('switch', { name: 'Live stream' });
		expect(control.getAttribute('aria-checked')).toBe('false');
		await fireEvent.click(control);
		expect(onchange).toHaveBeenLastCalledWith(true);
		expect(control.getAttribute('aria-checked')).toBe('true');
		await fireEvent.click(screen.getByText('Live stream'));
		expect(onchange).toHaveBeenLastCalledWith(false);
	});
});

describe('TextField', () => {
	it('asks for a number keyboard while keeping a text input', () => {
		render(TextField, { label: 'Height', inputmode: 'numeric' });
		const input = screen.getByRole('textbox', { name: 'Height' });
		expect(input.getAttribute('inputmode')).toBe('numeric');
		expect(input.getAttribute('type')).toBe('text');
	});

	it('leaves the keyboard alone by default', () => {
		render(TextField, { label: 'Name' });
		expect(screen.getByRole('textbox', { name: 'Name' }).hasAttribute('inputmode')).toBe(false);
	});
});

describe('EntityField', () => {
	it('opens the picker from a named button outside the label', async () => {
		render(EntityField, { label: 'Entity' });
		const button = screen.getByRole('button', { name: en.hearth_choose_entity });
		expect(button.closest('label')).toBeNull();
		await fireEvent.click(button);
		expect(screen.getByRole('dialog', { name: en.hearth_choose_entity })).toBeTruthy();
	});
});

describe('IconField', () => {
	it('labels its input and names the browse button', async () => {
		render(IconField, { label: 'Icon', value: 'lightbulb' });
		expect(screen.getByRole('textbox', { name: 'Icon' })).toBeTruthy();
		const browse = screen.getByRole('button', { name: en.hearth_browse_icons });
		expect(browse.getAttribute('aria-expanded')).toBe('false');
		await fireEvent.click(browse);
		expect(browse.getAttribute('aria-expanded')).toBe('true');
		expect(screen.getByRole('textbox', { name: en.hearth_search_all_icons })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'lightbulb' })).toBeTruthy();
	});
});

describe('EntityField entity feedback', () => {
	beforeEach(() => {
		states.set({
			'sensor.temperature': hassEntity('sensor.temperature', '21.5', {
				friendly_name: 'Living temperature',
				unit_of_measurement: 'C'
			}),
			'light.desk': hassEntity('light.desk', 'on', { friendly_name: 'Desk lamp' })
		});
	});

	it('shows the friendly name and the state with its unit under a known id', () => {
		const { container } = render(EntityField, { label: 'Entity', value: 'sensor.temperature' });
		const details = container.querySelector<HTMLElement>('.entity-details')!;
		expect(details.textContent).toContain('Living temperature');
		expect(details.textContent).toMatch(/21\.5\s*C/);
		const input = screen.getByRole('combobox', { name: 'Entity' });
		expect(input.getAttribute('aria-describedby')).toContain(details.id);
	});

	it('warns, without marking the field invalid, about an id Home Assistant does not report', () => {
		render(EntityField, { label: 'Entity', value: 'sensor.gone' });
		const warning = screen.getByText(en.hearth_entity_not_found);
		const input = screen.getByRole('combobox', { name: 'Entity' });
		expect(input.getAttribute('aria-invalid')).toBeNull();
		expect(input.getAttribute('aria-describedby')).toBe(warning.id);
		expect(warning.classList.contains('field-warning')).toBe(true);
	});

	it('warns about an id outside the allowed domains', () => {
		render(EntityField, { label: 'Entity', value: 'light.desk', domains: ['scene', 'script'] });
		expect(screen.getByText('This field takes Scene or Script entities')).toBeTruthy();
		// still a real entity, so its name shows too
		expect(screen.getByText('Desk lamp', { selector: '.entity-name' })).toBeTruthy();
	});

	it('holds the warning back while an id is being typed', async () => {
		render(EntityField, { label: 'Entity', value: '' });
		const input = screen.getByRole('combobox', { name: 'Entity' });
		await fireEvent.input(input, { target: { value: 'sensor.temp' } });
		expect(screen.queryByText(en.hearth_entity_not_found)).toBeNull();
		await fireEvent.change(input);
		expect(screen.getByText(en.hearth_entity_not_found)).toBeTruthy();
	});

	it('shows only the state under an id without a friendly name', () => {
		states.set({ 'sensor.bare': hassEntity('sensor.bare', '7') });
		const { container } = render(EntityField, { label: 'Entity', value: 'sensor.bare' });
		const details = container.querySelector('.entity-details')!;
		expect(details.querySelector('.entity-name')).toBeNull();
		expect(details.textContent?.trim()).toBe('7');
	});

	it('says nothing before the first states arrive', () => {
		states.set({});
		render(EntityField, { label: 'Entity', value: 'sensor.gone' });
		expect(screen.queryByText(en.hearth_entity_not_found)).toBeNull();
	});
});
