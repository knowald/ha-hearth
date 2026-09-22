import { fireEvent, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { motion } from '$lib/core/app/motion';
import Screensaver from './Screensaver.svelte';

async function showScreensaver() {
	const view = render(Screensaver, { minutes: 1 });
	vi.advanceTimersByTime(60_000);
	await tick();
	const overlay = view.container.querySelector('.screensaver') as HTMLElement;
	expect(overlay).not.toBeNull();
	return { ...view, overlay };
}

function cardUnderneath() {
	const card = document.createElement('button');
	const onclick = vi.fn();
	card.addEventListener('click', onclick);
	document.body.append(card);
	return { card, onclick };
}

describe('Screensaver', () => {
	// jsdom has no Web Animations; Svelte transitions call element.animate
	beforeAll(() => {
		Element.prototype.animate ??= () =>
			({ cancel() {}, finished: Promise.resolve() }) as unknown as Animation;
	});

	beforeEach(() => {
		vi.useFakeTimers();
		motion.set(0);
	});

	afterEach(() => {
		vi.useRealTimers();
		motion.set(190);
		document.body.innerHTML = '';
	});

	it('keeps the click of the wake tap from reaching the card underneath', async () => {
		const { container, overlay } = await showScreensaver();
		const { card, onclick } = cardUnderneath();

		await fireEvent.pointerDown(overlay);
		await tick();
		expect(container.querySelector('.screensaver')).toBeNull();

		await fireEvent.pointerUp(card);
		await fireEvent.click(card);
		expect(onclick).not.toHaveBeenCalled();
	});

	it('lets the next tap through once the wake click is spent', async () => {
		const { overlay } = await showScreensaver();
		const { card, onclick } = cardUnderneath();

		await fireEvent.pointerDown(overlay);
		await fireEvent.pointerUp(card);
		await fireEvent.click(card);
		await fireEvent.click(card);
		expect(onclick).toHaveBeenCalledTimes(1);
	});

	it('stops waiting for a click that never follows the release', async () => {
		const { overlay } = await showScreensaver();
		const { card, onclick } = cardUnderneath();

		await fireEvent.pointerDown(overlay);
		await fireEvent.pointerUp(card);
		vi.advanceTimersByTime(300);
		await fireEvent.click(card);
		expect(onclick).toHaveBeenCalledTimes(1);
	});

	it('wakes on a key press without swallowing a later click', async () => {
		const { container, overlay } = await showScreensaver();
		const { card, onclick } = cardUnderneath();

		await fireEvent.keyDown(overlay, { key: 'a' });
		await tick();
		expect(container.querySelector('.screensaver')).toBeNull();
		await fireEvent.click(card);
		expect(onclick).toHaveBeenCalledTimes(1);
	});

	it('takes focus while showing and hands it back on Escape', async () => {
		const { card } = cardUnderneath();
		card.focus();
		const { container, overlay } = await showScreensaver();
		expect(document.activeElement).toBe(overlay);

		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
		await tick();
		expect(container.querySelector('.screensaver')).toBeNull();
		expect(document.activeElement).toBe(card);
	});
});
