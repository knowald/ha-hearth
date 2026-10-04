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

/** How long the edit toggle waits on the edit chunks, like the revision check. */
export const EDIT_LOAD_PATIENCE_MS = 3000;

/**
 * False when a part failed to load. A load still running after `patience`
 * resolves true: edit mode opens and the parts appear when they arrive, and
 * should they fail after all, EditLoadError offers the way out.
 */
export function preloadEditMode(patience = EDIT_LOAD_PATIENCE_MS): Promise<boolean> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const loaded = Promise.all([loadEditBar(), loadEditorHost(), loadSortable()]).then(
		() => true,
		() => false
	);
	const waited = new Promise<boolean>((resolve) => {
		timer = setTimeout(() => resolve(true), patience);
	});
	return Promise.race([loaded, waited]).finally(() => clearTimeout(timer));
}
