import { describe, expect, it, vi } from 'vitest';
import type { TemplateRender } from '$lib/core/ha/templates';
import { loadMarkdownRenderer } from './markdown';
import { watchMarkdownTemplate, type MarkdownRender } from './templateMarkdown';

let push: ((render: TemplateRender) => void) | undefined;

vi.mock('$lib/core/ha/templates', () => ({
	watchTemplate: (_template: string, listener: (render: TemplateRender) => void) => {
		push = listener;
		return () => {};
	}
}));

vi.mock('./markdown', async (importOriginal) => {
	const original = await importOriginal<typeof import('./markdown')>();
	return { loadMarkdownRenderer: vi.fn(original.loadMarkdownRenderer) };
});

describe('watchMarkdownTemplate', () => {
	it('hands over results in arrival order, a result first converted to sanitized HTML', async () => {
		const renders: MarkdownRender[] = [];
		const stop = watchMarkdownTemplate('{{ x }}', (render) => renders.push(render));
		// the subscription code loads on first use
		await vi.waitFor(() => expect(push).toBeDefined());
		push!({ status: 'ready', result: '**a**<script>1</script>' });
		push!({ status: 'error', error: 'broken' });
		await vi.waitFor(() => expect(renders).toHaveLength(2));
		expect(renders[0]).toEqual({ status: 'ready', html: '<p><strong>a</strong></p>\n' });
		expect(renders[1]).toEqual({ status: 'error', error: 'broken' });

		stop();
		push!({ status: 'ready', result: 'late' });
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(renders).toHaveLength(2);
	});

	it('reports a renderer that fails to load and keeps handing over later results', async () => {
		vi.mocked(loadMarkdownRenderer).mockRejectedValueOnce(new Error('chunk failed'));
		const renders: MarkdownRender[] = [];
		push = undefined;
		watchMarkdownTemplate('{{ y }}', (render) => renders.push(render));
		await vi.waitFor(() => expect(push).toBeDefined());
		push!({ status: 'ready', result: 'one' });
		push!({ status: 'ready', result: 'two' });
		await vi.waitFor(() => expect(renders).toHaveLength(2));
		expect(renders[0]).toEqual({ status: 'error', error: 'chunk failed' });
		expect(renders[1]).toEqual({ status: 'ready', html: '<p>two</p>\n' });
	});
});
