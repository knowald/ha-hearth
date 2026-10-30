import { getContext, setContext } from 'svelte';
import { editor, type Editor } from '../../store';

const GUARD = Symbol('settings-guard');

/**
 * What the settings sheet tells its sections about server values staged in
 * it, which leaving the sheet (another editor, the setup wizard, a reload)
 * would drop.
 */
export interface SettingsGuard {
	/** Runs `leave` at once, or once the user agrees to drop the staged server values. */
	leave: (leave: () => void) => void;
	serverChanged: () => boolean;
}

const UNGUARDED: SettingsGuard = { leave: (leave) => leave(), serverChanged: () => false };

export function provideSettingsGuard(guard: SettingsGuard) {
	setContext(GUARD, guard);
}

/** The sheet's guard, or one that never asks outside a settings sheet. Call during component init. */
export function settingsGuard(): SettingsGuard {
	return getContext<SettingsGuard | undefined>(GUARD) ?? UNGUARDED;
}

/** Opens another editor from a settings row, through the sheet's guard. Call during component init. */
export function editorOpener(): (next: Editor) => void {
	const guard = settingsGuard();
	return (next) => guard.leave(() => editor.set(next));
}
