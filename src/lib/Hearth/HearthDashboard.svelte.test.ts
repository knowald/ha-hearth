import { fireEvent, render, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../static/translations/en.json';
import { hearthLoadError, hearthNeedsSetup, setupWizardOpen } from './store';
import HearthDashboard from './HearthDashboard.svelte';

vi.mock('$lib/core/ha/registry', () => ({ fetchRegistry: vi.fn(() => new Promise(() => {})) }));

describe('HearthDashboard first run', () => {
	beforeEach(() => {
		vi.stubGlobal('matchMedia', () => ({
			matches: false,
			addEventListener() {},
			removeEventListener() {}
		}));
		vi.stubGlobal(
			'ResizeObserver',
			class {
				observe() {}
				disconnect() {}
			}
		);
		Element.prototype.scrollTo ??= () => {};
		Element.prototype.animate ??= () =>
			({ cancel() {}, finished: Promise.resolve() }) as unknown as Animation;
	});
	afterEach(() => {
		hearthNeedsSetup.set(false);
		hearthLoadError.set(null);
		setupWizardOpen.set(false);
		vi.unstubAllGlobals();
	});

	it('keeps a way back to the area import on the home page after the wizard is skipped', async () => {
		hearthNeedsSetup.set(true);
		render(HearthDashboard);
		expect(get(setupWizardOpen)).toBe(true);
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_skip_for_now }));
		expect(get(setupWizardOpen)).toBe(false);
		await fireEvent.click(screen.getByRole('button', { name: en.hearth_setup }));
		expect(get(setupWizardOpen)).toBe(true);
	});

	it('offers no import prompt once the dashboard has content', () => {
		render(HearthDashboard);
		expect(screen.queryByText(en.hearth_setup_prompt)).toBeNull();
	});
});
