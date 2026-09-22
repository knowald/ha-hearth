import { get } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';
import { autocompleteOpen } from './codeEditorState';
import { layer, layerDepth, pushLayer } from './layers';

function pressEscape() {
	window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
}

describe('layers', () => {
	it('closes only the topmost layer on Escape', () => {
		const first = vi.fn();
		const second = vi.fn();
		const releaseFirst = pushLayer(first);
		const releaseSecond = pushLayer(second);
		expect(get(layerDepth)).toBe(2);

		pressEscape();
		expect(second).toHaveBeenCalledTimes(1);
		expect(first).not.toHaveBeenCalled();

		releaseSecond();
		pressEscape();
		expect(first).toHaveBeenCalledTimes(1);

		releaseFirst();
		expect(get(layerDepth)).toBe(0);
		pressEscape();
		expect(first).toHaveBeenCalledTimes(1);
	});

	it('ignores a release called twice', () => {
		const release = pushLayer(() => {});
		release();
		release();
		expect(get(layerDepth)).toBe(0);
	});
});

describe('layer action', () => {
	it('closes through the latest callback and returns focus to the opener', () => {
		const opener = document.createElement('button');
		const node = document.createElement('div');
		node.tabIndex = -1;
		document.body.append(opener, node);
		opener.focus();
		const first = vi.fn();
		const second = vi.fn();
		const action = layer(node, first);
		node.focus();
		action.update(second);
		pressEscape();
		expect(second).toHaveBeenCalledTimes(1);
		expect(first).not.toHaveBeenCalled();
		action.destroy();
		expect(document.activeElement).toBe(opener);
		expect(get(layerDepth)).toBe(0);
		opener.remove();
		node.remove();
	});

	it('leaves Escape to an open code completion list', () => {
		const close = vi.fn();
		const release = pushLayer(close);
		autocompleteOpen.set(true);
		pressEscape();
		expect(close).not.toHaveBeenCalled();
		autocompleteOpen.set(false);
		pressEscape();
		expect(close).toHaveBeenCalledTimes(1);
		release();
	});
});

function pressTab(shiftKey = false) {
	const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, cancelable: true });
	window.dispatchEvent(event);
	return event;
}

function dialogWithButtons(...labels: string[]) {
	const node = document.createElement('div');
	node.tabIndex = -1;
	for (const label of labels) {
		const button = document.createElement('button');
		button.textContent = label;
		node.append(button);
	}
	document.body.append(node);
	return { node, buttons: [...node.querySelectorAll('button')] };
}

describe('layer action focus', () => {
	it('moves focus to the first focusable element and cycles Tab inside', () => {
		const opener = document.createElement('button');
		document.body.append(opener);
		opener.focus();
		const { node, buttons } = dialogWithButtons('one', 'two');
		const action = layer(node, { close: () => {}, trap: true, initialFocus: true });
		expect(document.activeElement).toBe(buttons[0]);

		expect(pressTab(true).defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(buttons[1]);
		expect(pressTab().defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(buttons[0]);
		// between the ends the browser moves focus itself
		expect(pressTab().defaultPrevented).toBe(false);

		action.destroy();
		expect(document.activeElement).toBe(opener);
		opener.remove();
		node.remove();
	});

	it('pulls focus back in when it escaped the trapped layer', () => {
		const outside = document.createElement('button');
		document.body.append(outside);
		const { node, buttons } = dialogWithButtons('one', 'two');
		const action = layer(node, { close: () => {}, trap: true });
		outside.focus();
		pressTab();
		expect(document.activeElement).toBe(buttons[0]);
		action.destroy();
		outside.remove();
		node.remove();
	});

	it('focuses the element the layer picks and leaves Tab alone without a trap', () => {
		const { node, buttons } = dialogWithButtons('one', 'two');
		const action = layer(node, { close: () => {}, initialFocus: () => buttons[1] });
		expect(document.activeElement).toBe(buttons[1]);
		expect(pressTab().defaultPrevented).toBe(false);
		action.destroy();
		node.remove();
	});

	it('only the top layer traps Tab', () => {
		const { node: lower, buttons: lowerButtons } = dialogWithButtons('lower');
		const { node: upper, buttons: upperButtons } = dialogWithButtons('upper-one', 'upper-two');
		const lowerAction = layer(lower, { close: () => {}, trap: true });
		const upperAction = layer(upper, { close: () => {}, trap: false });
		lowerButtons[0].focus();
		expect(pressTab().defaultPrevented).toBe(false);
		upperAction.destroy();
		upperButtons[0].focus();
		pressTab();
		expect(document.activeElement).toBe(lowerButtons[0]);
		lowerAction.destroy();
		lower.remove();
		upper.remove();
	});

	it('leaves a Tab that a control inside already handled', () => {
		const { node, buttons } = dialogWithButtons('one', 'two');
		const action = layer(node, { close: () => {}, trap: true });
		buttons[1].addEventListener('keydown', (event) => event.preventDefault());
		buttons[1].focus();
		buttons[1].dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
		);
		expect(document.activeElement).toBe(buttons[1]);
		action.destroy();
		node.remove();
	});

	it('keeps focus that is already inside the layer', () => {
		const { node, buttons } = dialogWithButtons('one', 'two');
		buttons[1].focus();
		const action = layer(node, { close: () => {}, initialFocus: true });
		expect(document.activeElement).toBe(buttons[1]);
		action.destroy();
		node.remove();
	});
});
