import { render, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TemplateRender } from '$lib/core/ha/templates';
import { hearthEditMode } from '../../store';
import Card from './Card.svelte';

const listeners = new Map<string, (render: TemplateRender) => void>();
const stops: string[] = [];

vi.mock('$lib/core/ha/templates', () => ({
	watchTemplate: (template: string, listener: (render: TemplateRender) => void) => {
		listeners.set(template, listener);
		listener({ status: 'loading' });
		return () => stops.push(template);
	}
}));

afterEach(() => {
	listeners.clear();
	stops.length = 0;
	hearthEditMode.set(false);
});

async function mount(content = '{{ note }}') {
	const view = render(Card, { card: { id: 'note', type: 'template', content, title: 'Note' } });
	// the card body and the subscription code load on demand
	await waitFor(() => expect(listeners.has(content)).toBe(true));
	return view;
}

async function push(render: TemplateRender) {
	listeners.get('{{ note }}')!(render);
	// through the render queue and back into the DOM
	await new Promise((resolve) => setTimeout(resolve, 0));
	await tick();
}

describe('template card', () => {
	it('renders the Markdown result without scripts, frames or event handlers', async () => {
		const { container } = await mount();
		await push({
			status: 'ready',
			result:
				'**Door** open <script>window.hacked = 1</script>' +
				'<iframe src="https://example.com"></iframe>' +
				'<img src="x" onerror="window.hacked = 1"> <a href="javascript:alert(1)" onclick="x()">x</a>'
		});
		await waitFor(() => expect(container.querySelector('strong')?.textContent).toBe('Door'));
		const html = container.querySelector('.markdown')!.innerHTML;
		expect(html).not.toContain('<script');
		expect(html).not.toContain('<iframe');
		expect(html).not.toContain('onerror');
		expect(html).not.toContain('onclick');
		expect(html).not.toContain('javascript:');
		expect(container.querySelector('.section-title')?.textContent).toBe('Note');
	});

	it('shows a quiet placeholder while loading and on error outside edit mode', async () => {
		const { container } = await mount();
		await waitFor(() => expect(container.querySelector('.placeholder')).not.toBeNull());
		expect(container.querySelector('.section')?.getAttribute('aria-busy')).toBe('true');
		await push({ status: 'error', error: 'UndefinedError: note' });
		expect(container.querySelector('.placeholder')).not.toBeNull();
		expect(container.textContent).not.toContain('UndefinedError');
	});

	it('names the error in edit mode', async () => {
		hearthEditMode.set(true);
		const { container } = await mount();
		await push({ status: 'error', error: 'UndefinedError: note' });
		await waitFor(() =>
			expect(container.querySelector('.error')?.textContent).toContain('UndefinedError: note')
		);
	});

	it('stops following the template when it unmounts', async () => {
		const { unmount } = await mount();
		// the previous test's card unmounts after afterEach clears the list
		stops.length = 0;
		unmount();
		expect(stops).toEqual(['{{ note }}']);
	});

	it('goes back to the placeholder when the template is cleared', async () => {
		const { container, rerender } = await mount();
		await push({ status: 'ready', result: '**Door**' });
		await waitFor(() => expect(container.querySelector('strong')).not.toBeNull());
		await rerender({ card: { id: 'note', type: 'template', title: 'Note' } });
		await waitFor(() => expect(container.querySelector('.placeholder')).not.toBeNull());
		expect(container.querySelector('strong')).toBeNull();
	});
});
