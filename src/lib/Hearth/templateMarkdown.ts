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
	onrender: (render: MarkdownRender) => void,
	delay = 0
): () => void {
	let stopped = false;
	// queued so an error cannot overtake a result still waiting for the renderer
	let queue = Promise.resolve();
	const stop = watchTemplateLazily(
		template,
		(render) => {
			queue = queue.then(async () => {
				let next: MarkdownRender;
				try {
					next =
						render.status === 'ready'
							? { status: 'ready', html: (await loadMarkdownRenderer())(render.result) }
							: render;
				} catch (failure) {
					// one failed step must not stall the queue for every later result
					next = {
						status: 'error',
						error: failure instanceof Error ? failure.message : 'template_error'
					};
				}
				if (!stopped) onrender(next);
			});
		},
		delay
	);
	return () => {
		stopped = true;
		stop();
	};
}
