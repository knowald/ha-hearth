import type { TemplateRender } from '$lib/core/ha/templates';

/** How long an edited template rests before it is sent, so half-typed ones stay out of the HA log. */
export const EDIT_SETTLE_MS = 400;

/**
 * watchTemplate from core, loaded on first use so a dashboard without
 * templates never downloads the subscription code. `delay` holds the
 * subscription back, for templates that are still being typed.
 */
export function watchTemplateLazily(
	template: string,
	listener: (render: TemplateRender) => void,
	delay = 0
): () => void {
	let stop: (() => void) | undefined;
	let stopped = false;
	const load = () =>
		import('$lib/core/ha/templates').then(
			({ watchTemplate }) => {
				if (!stopped) stop = watchTemplate(template, listener);
			},
			(failure: { message?: unknown }) => {
				if (stopped) return;
				const error = typeof failure?.message === 'string' ? failure.message : 'template_error';
				listener({ status: 'error', error });
			}
		);
	let timer: ReturnType<typeof setTimeout> | undefined;
	if (delay > 0) timer = setTimeout(load, delay);
	else void load();
	return () => {
		stopped = true;
		clearTimeout(timer);
		stop?.();
	};
}
