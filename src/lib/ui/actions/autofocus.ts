/**
 * Whether a mouse or trackpad is the primary pointer. On a touch screen,
 * focusing a text field raises the on-screen keyboard over the content the
 * user came to look at, so fields only take focus by themselves here.
 */
export function finePointer(): boolean {
	return (
		typeof window !== 'undefined' &&
		typeof window.matchMedia === 'function' &&
		window.matchMedia('(pointer: fine)').matches
	);
}

/** Focuses the node on mount, unless that would raise an on-screen keyboard. */
export function autofocus(node: HTMLElement) {
	if (finePointer()) node.focus();
}
