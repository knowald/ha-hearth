import type { TemplateRender } from '$lib/core/ha/templates';

/**
 * watchTemplate from core, loaded on first use so a dashboard without
 * templates never downloads the subscription code.
 */
export function watchTemplateLazily(
	template: string,
	listener: (render: TemplateRender) => void
): () => void {
	let stop: (() => void) | undefined;
	let stopped = false;
	void import('$lib/core/ha/templates').then(({ watchTemplate }) => {
		if (!stopped) stop = watchTemplate(template, listener);
	});
	return () => {
		stopped = true;
		stop?.();
	};
}
