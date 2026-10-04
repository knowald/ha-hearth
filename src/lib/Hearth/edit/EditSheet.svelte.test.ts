import { fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { get } from 'svelte/store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../static/translations/en.json';
import { confirmRequestedAction, dismissConfirmation, requestedConfirmation } from '../store';
import EditSheet from './EditSheet.svelte';

const children = createRawSnippet(() => ({ render: () => '<div></div>' }));

function renderSheet(props: Record<string, unknown>) {
	const onremove = vi.fn();
	render(EditSheet, {
		title: 'Edit card',
		children,
		onclose: () => {},
		ondone: () => {},
		onremove,
		...props
	});
	return onremove;
}

describe('EditSheet remove action', () => {
	afterEach(dismissConfirmation);

	it('asks through the shared confirmation dialog before a destructive remove', async () => {
		const onremove = renderSheet({});
		await fireEvent.click(screen.getByRole('button', { name: en.remove }));
		expect(onremove).not.toHaveBeenCalled();
		expect(get(requestedConfirmation)).toMatchObject({
			title: en.hearth_remove_confirm_title,
			message: en.hearth_remove_confirm_message,
			confirmLabel: en.remove
		});
		// the label never turns into an inline "are you sure?" second tap
		expect(screen.queryByText(/are you sure/i)).toBeNull();
		confirmRequestedAction();
		expect(onremove).toHaveBeenCalledOnce();
	});

	it('runs a neutral remove at once with a non-danger button', async () => {
		const onremove = renderSheet({ removeLabel: en.hearth_unwrap, removeTone: 'neutral' });
		const button = screen.getByRole('button', { name: en.hearth_unwrap });
		expect(button.classList.contains('danger')).toBe(false);
		expect(button.classList.contains('secondary')).toBe(true);
		await fireEvent.click(button);
		expect(get(requestedConfirmation)).toBeNull();
		expect(onremove).toHaveBeenCalledOnce();
	});
});

describe('EditSheet initial focus', () => {
	const field = createRawSnippet(() => ({
		render: () => '<input aria-label="Title" data-autofocus />'
	}));

	afterEach(() => vi.unstubAllGlobals());

	it('focuses a field that asks for it under a mouse or trackpad', () => {
		vi.stubGlobal('matchMedia', (query: string) => ({
			matches: query === '(pointer: fine)',
			addEventListener: () => {},
			removeEventListener: () => {}
		}));
		renderSheet({ children: field });
		expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Title' }));
	});

	it('focuses Done instead on a touch screen, so no keyboard rises', () => {
		vi.stubGlobal('matchMedia', () => ({
			matches: false,
			addEventListener: () => {},
			removeEventListener: () => {}
		}));
		renderSheet({ children: field });
		expect(document.activeElement).toBe(screen.getByRole('button', { name: en.done }));
	});

	it('focuses a field marked always on a touch screen too', () => {
		vi.stubGlobal('matchMedia', () => ({
			matches: false,
			addEventListener: () => {},
			removeEventListener: () => {}
		}));
		const token = createRawSnippet(() => ({
			render: () => '<input aria-label="Token" data-autofocus="always" />'
		}));
		renderSheet({ children: token });
		expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Token' }));
	});
});

describe('EditSheet done reason', () => {
	it('shows the reason under a disabled Done and describes the button with it', () => {
		renderSheet({ doneDisabled: true, doneReason: 'Entity is required' });
		const done = screen.getByRole('button', { name: en.done });
		const reason = screen.getByText('Entity is required');
		expect(done).toHaveProperty('disabled', true);
		expect(done.getAttribute('aria-describedby')).toBe(reason.id);
		expect(reason.classList.contains('field-warning')).toBe(true);
	});

	it('keeps the line for a sheet that can block Done, so the form does not jump', () => {
		const { container } = render(EditSheet, {
			title: 'Edit card',
			children,
			onclose: () => {},
			ondone: () => {},
			doneReason: null
		});
		expect(container.querySelector('.done-reason')).not.toBeNull();
	});

	it('draws no line for a sheet that never blocks Done', () => {
		const { container } = render(EditSheet, {
			title: 'Edit card',
			children,
			onclose: () => {},
			ondone: () => {}
		});
		expect(container.querySelector('.done-reason')).toBeNull();
	});

	it('drops the reason once Done is enabled', () => {
		renderSheet({ doneDisabled: false, doneReason: 'Entity is required' });
		expect(screen.queryByText('Entity is required')).toBeNull();
		expect(
			screen.getByRole('button', { name: en.done }).getAttribute('aria-describedby')
		).toBeNull();
	});
});
