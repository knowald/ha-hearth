import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import EmptyState from './EmptyState.svelte';

describe('EmptyState', () => {
	it('renders an optional action button', async () => {
		const onclick = vi.fn();
		render(EmptyState, { text: 'Nothing yet', action: { label: 'Import', onclick } });
		await fireEvent.click(screen.getByRole('button', { name: 'Import' }));
		expect(onclick).toHaveBeenCalledTimes(1);
	});

	it('renders no button without an action', () => {
		render(EmptyState, { text: 'Nothing yet' });
		expect(screen.queryByRole('button')).toBeNull();
	});
});
