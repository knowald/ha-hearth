import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { get } from 'svelte/store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dismissConfirmation, requestConfirmation, requestedConfirmation } from '../store';
import ConfirmDialog from './ConfirmDialog.svelte';

function ask(title: string) {
	const action = vi.fn();
	const cancel = vi.fn();
	requestConfirmation({
		title,
		message: 'Message',
		confirmLabel: 'Go',
		cancelLabel: 'Other choice',
		action,
		cancel
	});
	return { action, cancel };
}

describe('ConfirmDialog', () => {
	afterEach(dismissConfirmation);

	it('runs the cancel choice from its button only, not from Escape', async () => {
		render(ConfirmDialog);
		const first = ask('First');
		await tick();
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
		expect(get(requestedConfirmation)).toBeNull();
		expect(first.cancel).not.toHaveBeenCalled();

		const second = ask('Second');
		await tick();
		await fireEvent.click(screen.getByRole('button', { name: 'Other choice' }));
		expect(second.cancel).toHaveBeenCalledOnce();
		expect(second.action).not.toHaveBeenCalled();
	});

	it('replaces an open request without running either of its choices', async () => {
		render(ConfirmDialog);
		const first = ask('First');
		await tick();
		ask('Second');
		await tick();
		expect(screen.getByRole('alertdialog').textContent).toContain('Second');
		expect(first.action).not.toHaveBeenCalled();
		expect(first.cancel).not.toHaveBeenCalled();
	});
});
