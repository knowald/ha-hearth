import { getContext, setContext } from 'svelte';
import { editor, type Editor } from '../../store';

const OPENER = Symbol('settings-opener');

export function provideEditorOpener(open: (next: Editor) => void) {
	setContext(OPENER, open);
}

/**
 * Opens another editor from a settings row. The settings sheet passes it
 * through its own check, since leaving the sheet drops staged server values;
 * outside the sheet it opens straight away. Call it during component init.
 */
export function editorOpener(): (next: Editor) => void {
	return getContext<((next: Editor) => void) | undefined>(OPENER) ?? ((next) => editor.set(next));
}
