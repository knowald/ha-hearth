import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, expect, it, vi } from 'vitest';
import translations from '../../static/translations/en.json';
import { tokenNeeded } from '$lib/core/ha/connection';
import Page from './+page.svelte';

vi.mock('$lib/core/ha/connection', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/core/ha/connection')>()),
	startConnection: vi.fn(),
	stopConnection: vi.fn()
}));

// the prompt's chunk fails the first time it is fetched
const loads = vi.hoisted(() => ({ count: 0 }));
vi.mock('$lib/Hearth/TokenPrompt.svelte', async (importOriginal) => {
	loads.count += 1;
	if (loads.count === 1) throw new Error('chunk failed to load');
	return importOriginal();
});

const data = {
	configuration: { hassUrl: 'http://localhost:8123' },
	translations
} as unknown as Parameters<typeof Page>[1]['data'];

afterEach(() => {
	tokenNeeded.set(false);
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

it('lets Sign in try again when the token prompt failed to load', async () => {
	vi.stubGlobal('matchMedia', () => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {}
	}));
	const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	render(Page, { data });
	tokenNeeded.set(true);
	await vi.waitFor(() => expect(warn).toHaveBeenCalled());
	await tick();
	expect(screen.queryByRole('dialog', { name: 'Sign in' })).toBeNull();

	await fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
	expect(await screen.findByRole('dialog', { name: 'Sign in' })).toBeTruthy();
});
