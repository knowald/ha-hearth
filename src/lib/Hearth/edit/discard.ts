import { get } from 'svelte/store';
import { lang } from '$lib/core/i18n';
import { requestConfirmation } from '../store';

/** Runs `leave` at once when the sheet holds nothing staged, else once the user agrees to drop it. */
export function confirmDiscard(dirty: boolean, leave: () => void) {
	if (!dirty) {
		leave();
		return;
	}
	const text = get(lang);
	requestConfirmation({
		title: text('hearth_discard_sheet_title'),
		message: text('hearth_discard_sheet_message'),
		confirmLabel: text('hearth_discard'),
		action: leave
	});
}
