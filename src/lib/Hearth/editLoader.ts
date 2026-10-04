import { loadSortable } from '$lib/ui/actions/sortable';

/*
 * Edit mode's code loads on demand rather than with the dashboard. The edit
 * toggle warms it on approach and waits for it before turning edit mode on,
 * so the bar replaces the toggle without a gap.
 */

export function loadEditBar() {
	return import('./shell/EditBar.svelte');
}

export function loadEditorHost() {
	return import('./edit/EditorHost.svelte');
}

/** Never rejects: a failure is reported by the load that renders the part. */
export function preloadEditMode(): Promise<void> {
	return Promise.all([loadEditBar(), loadEditorHost(), loadSortable()]).then(
		() => undefined,
		() => undefined
	);
}
