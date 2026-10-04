import { watchTemplateLazily } from './lazyTemplates';
import { loadMarkdownRenderer } from './markdown';

export type MarkdownRender =
	{ status: 'loading' } | { status: 'ready'; html: string } | { status: 'error'; error: string };

/**
 * Follows a Home Assistant template and hands every result over as sanitized
 * HTML from its Markdown, ready for {@html}. Returns the function that stops.
 */
export function watchMarkdownTemplate(
	template: string,
	onrender: (render: MarkdownRender) => void
): () => void {
	let stopped = false;
	// queued so an error cannot overtake a result still waiting for the renderer
	let queue = Promise.resolve();
	const stop = watchTemplateLazily(template, (render) => {
		queue = queue.then(async () => {
			const next: MarkdownRender =
				render.status === 'ready'
					? { status: 'ready', html: (await loadMarkdownRenderer())(render.result) }
					: render;
			if (!stopped) onrender(next);
		});
	});
	return () => {
		stopped = true;
		stop();
	};
}
