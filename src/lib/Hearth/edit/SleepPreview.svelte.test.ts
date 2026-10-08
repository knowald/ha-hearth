import { render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_HEARTH_CONFIG } from '../config';
import { hearthConfig } from '../store';
import SleepPreview from './SleepPreview.svelte';

let report: (visible: boolean) => void = () => {};

class FakeIntersectionObserver {
	constructor(callback: IntersectionObserverCallback) {
		report = (visible) =>
			callback(
				[{ isIntersecting: visible } as IntersectionObserverEntry],
				this as unknown as IntersectionObserver
			);
	}
	observe() {}
	disconnect() {}
}

describe('SleepPreview', () => {
	const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');

	beforeEach(() => {
		vi.useFakeTimers();
		vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
		// jsdom lays nothing out; the preview only draws at a measured width
		Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
			configurable: true,
			get: () => 320
		});
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		if (clientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth);
	});

	it('keeps the scene through a quick scroll away and back, and drops it after a while', async () => {
		const { container } = render(SleepPreview);
		await tick();
		expect(container.querySelector('.scene')).not.toBeNull();

		report(false);
		vi.advanceTimersByTime(500);
		report(true);
		vi.advanceTimersByTime(5000);
		await tick();
		expect(container.querySelector('.scene')).not.toBeNull();

		report(false);
		vi.advanceTimersByTime(5000);
		await tick();
		expect(container.querySelector('.scene')).toBeNull();
	});
});
