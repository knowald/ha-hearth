/**
 * Puts text on the clipboard. False when neither the Clipboard API nor the
 * older copy command took it: a page served over plain http on the LAN is no
 * secure context and has no Clipboard API, so the caller then shows the text
 * for copying by hand.
 */
export async function copyText(text: string): Promise<boolean> {
	try {
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(text);
			return true;
		}
	} catch {
		// refused, for instance without permission; the copy command may still work
	}
	return copyCommand(text);
}

function copyCommand(text: string): boolean {
	if (typeof document.execCommand !== 'function') return false;
	const area = document.createElement('textarea');
	area.value = text;
	area.setAttribute('readonly', '');
	area.style.position = 'fixed';
	area.style.opacity = '0';
	document.body.append(area);
	area.select();
	try {
		return document.execCommand('copy');
	} catch {
		return false;
	} finally {
		area.remove();
	}
}

/** The clipboard's text, or undefined where the page may not read it. */
export async function readClipboard(): Promise<string | undefined> {
	try {
		return await navigator.clipboard?.readText?.();
	} catch {
		return undefined;
	}
}
