import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configuration } from '$lib/core/app/configuration';
import { connectionError, health } from '$lib/core/ha/connection';
import TokenPrompt from './TokenPrompt.svelte';

describe('TokenPrompt', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		configuration.set({});
		health.set('booting');
		connectionError.set(undefined);
	});

	async function submitToken() {
		const onclose = vi.fn();
		configuration.set({ hassUrl: 'http://ha.local', revision: 3 });
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({ ok: true, json: async () => ({ revision: 4 }) })
		);
		render(TokenPrompt, { onclose });
		await fireEvent.input(screen.getByLabelText('Long-lived access token'), {
			target: { value: 'secret-token' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
		await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Checking'));
		return onclose;
	}

	it('styles the token field as a password input in the login sheet', async () => {
		const onclose = vi.fn();
		render(TokenPrompt, { onclose });
		const dialog = screen.getByRole('dialog', { name: 'Sign in' });
		const input = screen.getByLabelText('Long-lived access token') as HTMLInputElement;
		expect(dialog.contains(input)).toBe(true);
		expect(input.type).toBe('password');
		expect((screen.getByRole('button', { name: 'Sign in' }) as HTMLButtonElement).disabled).toBe(
			true
		);

		await fireEvent.input(input, { target: { value: 'secret-token' } });
		expect((screen.getByRole('button', { name: 'Sign in' }) as HTMLButtonElement).disabled).toBe(
			false
		);
	});

	it('saves the token and closes once Home Assistant accepts it', async () => {
		const onclose = vi.fn();
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ revision: 4 }) });
		configuration.set({ hassUrl: 'http://ha.local', revision: 3 });
		vi.stubGlobal('fetch', fetchMock);
		render(TokenPrompt, { onclose });
		await fireEvent.input(screen.getByLabelText('Long-lived access token'), {
			target: { value: 'secret-token' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
		await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Checking'));
		expect(onclose).not.toHaveBeenCalled();
		health.set('connected');
		await waitFor(() => expect(onclose).toHaveBeenCalledTimes(1));
		expect(fetchMock).toHaveBeenCalledOnce();
		expect(fetchMock.mock.calls[0][0]).toBe('/_api/save_config');
		expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
			token: 'secret-token',
			revision: 3
		});
	});

	it('stays open and says so when Home Assistant rejects the token', async () => {
		const onclose = await submitToken();
		connectionError.set('invalid_auth');
		const alert = await screen.findByRole('alert');
		expect(alert.textContent).toContain('Home Assistant rejected this token');
		expect(onclose).not.toHaveBeenCalled();
		expect((screen.getByLabelText('Long-lived access token') as HTMLInputElement).value).toBe(
			'secret-token'
		);
		expect(screen.getByRole('status').textContent).toBe('');
	});

	it('keeps checking while Home Assistant is unreachable', async () => {
		const onclose = await submitToken();
		connectionError.set('cannot_connect');
		await tick();
		expect(screen.queryByRole('alert')).toBeNull();
		expect(screen.getByRole('status').textContent).toContain('Checking');
		expect(onclose).not.toHaveBeenCalled();
	});

	it('explains a rejected saved token in the hint', () => {
		configuration.set({ hassUrl: 'http://ha.local', token: 'revoked' });
		render(TokenPrompt, { onclose: vi.fn() });
		expect(screen.getByText(/Home Assistant rejected the saved token/)).toBeTruthy();
	});
});
