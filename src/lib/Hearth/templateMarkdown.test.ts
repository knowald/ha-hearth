import { describe, expect, it, vi } from 'vitest';
import type { TemplateRender } from '$lib/core/ha/templates';
import { watchMarkdownTemplate, type MarkdownRender } from './templateMarkdown';

let push: ((render: TemplateRender) => void) | undefined;

vi.mock('$lib/core/ha/templates', () => ({
	watchTemplate: (_template: string, listener: (render: TemplateRender) => void) => {
		push = listener;
		return () => {};
	}
}));

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
});
