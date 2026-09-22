import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import SearchOverlay from './SearchOverlay.svelte';

function backdrop(container: HTMLElement) {
	return container.querySelector('.overlay') as HTMLElement;
}

describe('SearchOverlay', () => {
	it('stays open until the backdrop tap completes as a click', async () => {
		const onclose = vi.fn();
		const { container } = render(SearchOverlay, { onclose });
		await fireEvent.pointerDown(backdrop(container));
		expect(onclose).not.toHaveBeenCalled();
		await fireEvent.click(backdrop(container));
		expect(onclose).toHaveBeenCalledTimes(1);
	});

	it('ignores a press that starts in the panel and ends on the backdrop', async () => {
		const onclose = vi.fn();
		const { container } = render(SearchOverlay, { onclose });
		await fireEvent.pointerDown(container.querySelector('.panel') as HTMLElement);
		await fireEvent.click(backdrop(container));
		expect(onclose).not.toHaveBeenCalled();
	});

	it('ignores clicks inside the panel', async () => {
		const onclose = vi.fn();
		const { container } = render(SearchOverlay, { onclose });
		const panel = container.querySelector('.panel') as HTMLElement;
		await fireEvent.pointerDown(panel);
		await fireEvent.click(panel);
		expect(onclose).not.toHaveBeenCalled();
	});
});
