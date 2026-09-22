import { act, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { motion } from '$lib/core/app/motion';
import { MOTION } from '$lib/core/theme';
import ThemeStyle from './ThemeStyle.svelte';
import dashboardSource from '../HearthDashboard.svelte?raw';

describe('ThemeStyle', () => {
	afterEach(() => {
		motion.set(MOTION.base);
		delete document.documentElement.dataset.motion;
	});

	it('marks the root and zeroes the motion tokens when motion is off', async () => {
		render(ThemeStyle);
		expect(document.documentElement.dataset.motion).toBeUndefined();

		await act(() => motion.set(0));
		expect(document.documentElement.dataset.motion).toBe('off');
		const css = document.head.innerHTML;
		for (const name of Object.keys(MOTION)) {
			expect(css).toMatch(
				new RegExp(`:root\\[data-motion='off'\\] \\{[^}]*--h-motion-${name}: 0ms;`)
			);
		}

		await act(() => motion.set(MOTION.base));
		expect(document.documentElement.dataset.motion).toBeUndefined();
	});

	it('stops the pending pulse and press scale on the dashboard when motion is off', () => {
		const rule = (selector: string) =>
			dashboardSource.match(
				new RegExp(`html\\[data-motion='off'\\]\\) \\.frame :global\\(${selector}\\) \\{([^}]*)\\}`)
			)?.[1];
		expect(rule('\\.pending')).toMatch(/animation: none;/);
		expect(rule('\\.pending')).toMatch(/opacity:/);
		expect(rule('\\.pressable:active')).toMatch(/transform: none;/);
	});
});
