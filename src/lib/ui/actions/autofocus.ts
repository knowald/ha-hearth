import { finePointer } from '$lib/core/app/pointer';

/**
 * Focuses the node on mount where a mouse or trackpad is the primary pointer.
 * On a touch screen, focusing a text field raises the on-screen keyboard over
 * the content the user came to look at.
 */
export function autofocus(node: HTMLElement) {
	if (finePointer()) node.focus();
}
