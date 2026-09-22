import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import EntityField from './EntityField.svelte';
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
	['EntityField', EntityField, 'combobox', {}]
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
