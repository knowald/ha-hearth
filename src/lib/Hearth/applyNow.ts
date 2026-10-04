import { get } from 'svelte/store';
import {
	enterEditMode,
	hearthConfig,
	hearthEditMode,
	hearthNeedsSetup,
	saveState,
	saveWithFeedback,
	updateConfig,
	type UnsavedChange
} from './store';
import type { HearthConfig } from './config';

/**
 * Applies a change to the dashboard from outside the editor, such as an
 * import or a suggested card. In edit mode it joins the draft. Otherwise
 * nothing else would persist it and a reload would silently drop it, so it
 * is saved at once; only the edit bar reports a failed or conflicting save
 * and offers a retry, so a save that does not go through hands the change
 * over to edit mode, where Cancel returns to the dashboard from before it.
 */
export async function applyNow(
	mutate: (config: HearthConfig) => void,
	after: () => void = () => {}
): Promise<void> {
	const before: UnsavedChange = { config: get(hearthConfig), needsSetup: get(hearthNeedsSetup) };
	updateConfig(mutate);
	after();
	if (get(hearthEditMode)) return;
	await saveWithFeedback();
	if (get(saveState) !== 'saved') enterEditMode(before);
}
