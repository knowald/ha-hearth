import { get, writable } from 'svelte/store';
import { reloadPage } from '$lib/core/app/reload';
import { lang } from '$lib/core/i18n';
import {
	enterEditMode,
	fetchServerRevision,
	hearthConfig,
	hearthEditMode,
	hearthNeedsSetup,
	hearthRevision,
	requestConfirmation,
	requestedConfirmation,
	saveState,
	saveWithFeedback,
	updateConfig,
	type RequestedConfirmation,
	type UnsavedChange
} from './store';
import type { HearthConfig } from './config';

/**
 * `applied` is in the draft (edit mode) or saved, `unsaved` was handed to
 * edit mode after its save failed, `declined` was not applied at all.
 */
export type ApplyOutcome = 'applied' | 'unsaved' | 'declined';

/** True while a change applied from outside the editor is being saved. */
export const applying = writable(false);

let queue: Promise<unknown> = Promise.resolve();
let pending = 0;

/**
 * Applies a change to the dashboard from outside the editor, such as an
 * import or a suggested card. In edit mode it joins the draft. Otherwise
 * nothing else would persist it and a reload would silently drop it, so it
 * is saved at once; only the edit bar reports a failed or conflicting save
 * and offers a retry, so a save that does not go through hands the change
 * over to edit mode, where Cancel returns to the dashboard from before it.
 *
 * Calls run one after another: a second change applied while the first is
 * saving would otherwise land after the request was sent and stay unsaved.
 */
export function applyNow(
	mutate: (config: HearthConfig) => void,
	after: () => void = () => {}
): Promise<ApplyOutcome> {
	pending += 1;
	applying.set(true);
	const run = queue.then(() => applyOne(mutate, after));
	queue = run.catch(() => {});
	return run.finally(() => {
		pending -= 1;
		if (!pending) applying.set(false);
	});
}

async function applyOne(
	mutate: (config: HearthConfig) => void,
	after: () => void
): Promise<ApplyOutcome> {
	if (!get(hearthEditMode)) {
		// the same check the edit button makes: a change to a revision another
		// screen has replaced only ends in a conflict on save
		const revision = await fetchServerRevision();
		if (revision !== undefined && revision > get(hearthRevision) && !(await applyAnyway())) {
			return 'declined';
		}
	}
	const before: UnsavedChange = { config: get(hearthConfig), needsSetup: get(hearthNeedsSetup) };
	updateConfig(mutate);
	after();
	if (get(hearthEditMode)) return 'applied';
	let sent: HearthConfig;
	do {
		sent = get(hearthConfig);
		await saveWithFeedback();
		// a change made while the request was out is still unsaved; send it too
	} while (get(saveState) === 'saved' && get(hearthConfig) !== sent && !get(hearthEditMode));
	if (get(saveState) === 'saved') return 'applied';
	enterEditMode(before);
	return 'unsaved';
}

/** Offers to reload; resolves true when the user applies to this version anyway. */
function applyAnyway(): Promise<boolean> {
	const text = get(lang);
	return new Promise((resolve) => {
		let settled = false;
		const settle = (value: boolean) => {
			if (settled) return;
			settled = true;
			stop();
			resolve(value);
		};
		const request: RequestedConfirmation = {
			title: text('hearth_newer_config_title'),
			message: text('hearth_newer_config_apply_message'),
			confirmLabel: text('hearth_reload'),
			action: () => {
				settle(false);
				void reloadPage();
			},
			cancelLabel: text('hearth_apply_anyway'),
			cancel: () => settle(true)
		};
		requestConfirmation(request);
		// the cancel choice runs right after the dialog clears, so a cleared
		// dialog only counts as dismissed once that has had its turn
		const stop = requestedConfirmation.subscribe((current) => {
			if (current !== request) queueMicrotask(() => settle(false));
		});
	});
}
