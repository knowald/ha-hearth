import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { get } from 'svelte/store';
import { afterEach, describe, expect, it } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import en from '../../../static/translations/en.json';
import ControlPopup from './ControlPopup.svelte';
import { popup } from './store';

async function openFan() {
	states.set({ 'fan.ceiling': hassEntity('fan.ceiling', 'off', { friendly_name: 'Ceiling' }) });
	const opener = document.createElement('button');
	document.body.append(opener);
	opener.focus();
	const view = render(ControlPopup);
	popup.set({ kind: 'fan', entity: 'fan.ceiling', name: 'Ceiling' });
	await tick();
	return { ...view, opener, overlay: view.container.querySelector('.overlay') as HTMLElement };
}

describe('ControlPopup', () => {
	afterEach(() => {
		popup.set(null);
		document.body.innerHTML = '';
	});

	it('is a named modal dialog that takes focus and hands it back on close', async () => {
		const { opener } = await openFan();
		const dialog = screen.getByRole('dialog', { name: 'Ceiling' });
		expect(dialog.getAttribute('aria-modal')).toBe('true');
		const close = screen.getByRole('button', { name: en.hearth_close });
		expect(document.activeElement).toBe(close);

		await fireEvent.click(close);
		expect(get(popup)).toBeNull();
		expect(document.activeElement).toBe(opener);
	});

	it('keeps Tab inside the popup', async () => {
		await openFan();
		const dialog = screen.getByRole('dialog');
		screen.getByRole('button', { name: en.hearth_close }).focus();
		window.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true })
		);
		expect(dialog.contains(document.activeElement)).toBe(true);
	});

	it('closes on a backdrop tap but not on a drag that started inside the panel', async () => {
		const { overlay } = await openFan();
		const dialog = screen.getByRole('dialog');

		await fireEvent.pointerDown(dialog);
		await fireEvent.click(overlay);
		expect(get(popup)).not.toBeNull();

		await fireEvent.pointerDown(overlay);
		await fireEvent.click(overlay);
		expect(get(popup)).toBeNull();
	});

	it('closes on Escape', async () => {
		await openFan();
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
		expect(get(popup)).toBeNull();
	});

	it('gives the light popup a switch', async () => {
		states.set({ 'light.desk': hassEntity('light.desk', 'on', { friendly_name: 'Desk' }) });
		render(ControlPopup);
		popup.set({ kind: 'light', entity: 'light.desk', name: 'Desk' });
		await tick();
		const toggle = screen.getByRole('switch', { name: en.hearth_toggle_light });
		expect(toggle.getAttribute('aria-checked')).toBe('true');
	});
});
