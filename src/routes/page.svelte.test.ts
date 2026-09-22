import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import translations from '../../static/translations/en.json';
import { tokenNeeded } from '$lib/core/ha/connection';
import Page from './+page.svelte';

vi.mock('$lib/core/ha/connection', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/core/ha/connection')>()),
	startConnection: vi.fn(),
	stopConnection: vi.fn()
}));

const data = {
	configuration: { hassUrl: 'http://localhost:8123' },
	translations
} as unknown as Parameters<typeof Page>[1]['data'];

describe('boot screen', () => {
	beforeEach(() => vi.stubGlobal('matchMedia', () => ({ matches: false })));
	afterEach(() => {
		tokenNeeded.set(false);
		vi.unstubAllGlobals();
	});

	it('offers no login while authentication can proceed on its own', () => {
		render(Page, { data });
		expect(screen.getByText('Connecting to Home Assistant...')).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Log in' })).toBeNull();
		expect(screen.queryByRole('dialog', { name: 'Log in' })).toBeNull();
	});

	it('opens the token prompt once a token is needed and reopens it from the button', async () => {
		render(Page, { data });
		tokenNeeded.set(true);
		await tick();
		expect(screen.getByRole('dialog', { name: 'Log in' })).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
		expect(screen.queryByRole('dialog', { name: 'Log in' })).toBeNull();
		await fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
		expect(screen.getByRole('dialog', { name: 'Log in' })).toBeTruthy();
	});
});
