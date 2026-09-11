import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configuration } from '$lib/core/app/configuration';
import TokenPrompt from './TokenPrompt.svelte';

describe('TokenPrompt', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		configuration.set({});
	});

	it('styles the token field as a password input in the login sheet', async () => {
		const onclose = vi.fn();
		render(TokenPrompt, { onclose });
		const dialog = screen.getByRole('dialog', { name: 'Log in' });
		const input = screen.getByLabelText('Long-lived access token') as HTMLInputElement;
		expect(dialog.contains(input)).toBe(true);
		expect(input.type).toBe('password');
		expect((screen.getByRole('button', { name: 'Done' }) as HTMLButtonElement).disabled).toBe(true);

		await fireEvent.input(input, { target: { value: 'secret-token' } });
		expect((screen.getByRole('button', { name: 'Done' }) as HTMLButtonElement).disabled).toBe(
			false
		);
	});

	it('saves the token and closes', async () => {
		const onclose = vi.fn();
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ revision: 4 }) });
		configuration.set({ hassUrl: 'http://ha.local', revision: 3 });
		vi.stubGlobal('fetch', fetchMock);
		render(TokenPrompt, { onclose });
		await fireEvent.input(screen.getByLabelText('Long-lived access token'), {
			target: { value: 'secret-token' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Done' }));
		await waitFor(() => expect(onclose).toHaveBeenCalledTimes(1));
		expect(fetchMock).toHaveBeenCalledOnce();
		expect(fetchMock.mock.calls[0][0]).toBe('/_api/save_config');
		expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
			token: 'secret-token',
			revision: 3
		});
	});
});
