import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../static/translations/en.json';
import CloseButton from './CloseButton.svelte';

describe('CloseButton', () => {
	it('is a real button named from the translations', async () => {
		const onclick = vi.fn();
		render(CloseButton, { onclick });
		const button = screen.getByRole('button', { name: en.hearth_close });
		expect(button.tagName).toBe('BUTTON');
		expect(button.getAttribute('type')).toBe('button');
		await fireEvent.click(button);
		expect(onclick).toHaveBeenCalledTimes(1);
	});
});
