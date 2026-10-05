import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import EditChip from './EditChip.svelte';

describe('EditChip', () => {
	it('is a real button named after what it edits', async () => {
		const onedit = vi.fn();
		render(EditChip, { label: 'Edit Lights', onedit });
		const button = screen.getByRole('button', { name: 'Edit Lights' });
		expect(button.tagName).toBe('BUTTON');
		expect(button.getAttribute('type')).toBe('button');
		await fireEvent.click(button);
		expect(onedit).toHaveBeenCalledTimes(1);
	});
});
