import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import translations from '../../static/translations/en.json';
import {
	connectionError,
	failedAttempts,
	startConnection,
	tokenNeeded
} from '$lib/core/ha/connection';
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
		connectionError.set(undefined);
		failedAttempts.set(0);
		vi.unstubAllGlobals();
		vi.clearAllMocks();
	});

	it('offers no login while authentication can proceed on its own', () => {
		render(Page, { data });
		expect(screen.getByRole('status').textContent).toContain('Connecting to Home Assistant...');
		expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
		expect(screen.queryByRole('dialog', { name: 'Sign in' })).toBeNull();
	});

	it('opens the token prompt once a token is needed and reopens it from the button', async () => {
		render(Page, { data });
		tokenNeeded.set(true);
		await tick();
		expect(screen.getByRole('dialog', { name: 'Sign in' })).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
		expect(screen.queryByRole('dialog', { name: 'Sign in' })).toBeNull();
		await fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
		expect(screen.getByRole('dialog', { name: 'Sign in' })).toBeTruthy();
	});

	it('asks to sign in instead of spinning while a token is needed', async () => {
		const { container } = render(Page, { data });
		tokenNeeded.set(true);
		await tick();
		await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
		const status = screen.getByRole('status');
		expect(status.textContent).toContain('Sign in required');
		expect(status.textContent).not.toContain('Connecting');
		expect(container.querySelector('.boot-mark')).toBeNull();
	});

	it('says the saved token was rejected when one is configured', async () => {
		render(Page, {
			data: { ...data, configuration: { hassUrl: 'http://localhost:8123', token: 'old' } }
		});
		tokenNeeded.set(true);
		await tick();
		await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
		expect(screen.getByRole('status').textContent).toContain(
			'Home Assistant rejected the saved token'
		);
	});

	it('keeps spinning through the first failed attempts', async () => {
		const { container } = render(Page, { data });
		connectionError.set('cannot_connect');
		failedAttempts.set(2);
		await tick();
		expect(screen.getByRole('status').textContent).toContain('Connecting to Home Assistant...');
		expect(container.querySelector('.boot-mark')).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
	});

	it.each([
		['cannot_connect', 'Check that Home Assistant is running'],
		['https_to_http', 'Use an HTTPS HASS_URL'],
		['unknown', 'Check the browser console']
	] as const)('explains a %s failure and offers a retry', async (code, hint) => {
		const { container } = render(Page, { data });
		connectionError.set(code);
		failedAttempts.set(3);
		await tick();
		const status = screen.getByRole('status');
		expect(status.textContent).toContain('Cannot connect to Home Assistant');
		expect(status.textContent).toContain(hint);
		expect(container.querySelector('.boot-mark')).toBeNull();
		vi.mocked(startConnection).mockClear();
		await fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
		expect(startConnection).toHaveBeenCalledWith(data.configuration);
	});
});
