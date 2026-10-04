import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
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
