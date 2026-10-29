import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configuration } from '$lib/core/app/configuration';
import { english as en } from '$lib/core/i18n/testing';
import ServerSection from './ServerSection.svelte';

const reduceMotion = () => screen.getByRole('switch', { name: en.hearth_reduce_motion });

describe('ServerSection', () => {
	const saves: Record<string, unknown>[] = [];

	beforeEach(() => {
		saves.length = 0;
		configuration.set({ locale: 'en', revision: 2 } as never);
		vi.stubGlobal(
			'fetch',
			vi.fn(async (address: string, init?: RequestInit) => {
				if (!address.endsWith('/_api/save_config'))
					return { ok: false, json: async (): Promise<unknown> => null };
				saves.push(JSON.parse(String(init?.body)));
				return { ok: true, status: 200, json: async (): Promise<unknown> => ({ revision: 3 }) };
			})
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		configuration.set(undefined as never);
	});

	it('lets the parent discard staged values', async () => {
		const { component } = render(ServerSection);
		await fireEvent.click(reduceMotion());
		expect(reduceMotion().getAttribute('aria-checked')).toBe('true');
		component.discard();
		await waitFor(() => expect(reduceMotion().getAttribute('aria-checked')).toBe('false'));
	});

	it('lets the parent save, then reports back', async () => {
		const onsaved = vi.fn();
		const { component } = render(ServerSection, { props: { onsaved } });
		await fireEvent.click(reduceMotion());
		await component.save();
		expect(saves).toEqual([{ locale: 'en', revision: 2, motion: false }]);
		expect(get(configuration)?.revision).toBe(3);
		expect(onsaved).toHaveBeenCalledOnce();
	});

	it('keeps a failed save inside the section', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({ ok: false, status: 403, json: async (): Promise<unknown> => null }))
		);
		const onsaved = vi.fn();
		const { component } = render(ServerSection, { props: { onsaved } });
		await component.save();
		expect((await screen.findByRole('alert')).textContent).toContain(en.hearth_save_needs_admin);
		expect(onsaved).not.toHaveBeenCalled();
	});
});
