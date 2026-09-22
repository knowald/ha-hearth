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
		expect(screen.queryByText(new RegExp(en.hearth_are_you_sure))).toBeNull();
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
