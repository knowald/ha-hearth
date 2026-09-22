import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import Switch from './Switch.svelte';

describe('Switch', () => {
	it('is a named switch that reports its state and asks for the opposite', async () => {
		const onchange = vi.fn();
		const { rerender } = render(Switch, { checked: false, label: 'Reduce motion', onchange });
		const control = screen.getByRole('switch', { name: 'Reduce motion' });
		expect(control.tagName).toBe('BUTTON');
		expect(control.getAttribute('aria-checked')).toBe('false');

		await fireEvent.click(control);
		expect(onchange).toHaveBeenCalledWith(true);

		await rerender({ checked: true, label: 'Reduce motion', onchange });
		expect(control.getAttribute('aria-checked')).toBe('true');
		await fireEvent.click(control);
		expect(onchange).toHaveBeenLastCalledWith(false);
	});

	it('marks a pending command', () => {
		render(Switch, { checked: true, label: 'Light', onchange: vi.fn(), pending: true });
		expect(screen.getByRole('switch').classList.contains('pending')).toBe(true);
	});
});
