// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'fs/promises';
import { load } from './+page.server';

vi.mock('fs/promises', () => ({ readFile: vi.fn() }));

beforeEach(() => {
	vi.mocked(readFile).mockResolvedValue('');
	vi.stubEnv('HASS_URL', 'http://homeassistant:8123');
	vi.stubEnv('HASS_PUBLIC_URL', '');
});
afterEach(() => vi.unstubAllEnvs());

async function configuration(ingress = false) {
	const request = new Request('http://container:8099/', {
		headers: ingress ? { 'X-Ingress-Path': '/api/hassio_ingress/session' } : {}
	});
	return (await load({ request })).configuration;
}

describe('browser Home Assistant URL', () => {
	it('uses the browser origin under Ingress instead of the internal server address', async () => {
		expect((await configuration(true)).hassUrl).toBe('/');
		expect(process.env.HASS_URL).toBe('http://homeassistant:8123');
	});

	it('preserves the configured URL for direct access', async () => {
		expect((await configuration()).hassUrl).toBe('http://homeassistant:8123');
	});

	it.each([true, false])('honors an explicit public URL (Ingress: %s)', async (ingress) => {
		vi.stubEnv('HASS_PUBLIC_URL', 'https://ha.example.com');
		expect((await configuration(ingress)).hassUrl).toBe('https://ha.example.com');
		expect(process.env.HASS_URL).toBe('http://homeassistant:8123');
	});

	it('keeps the missing configuration state for standalone access', async () => {
		vi.stubEnv('HASS_URL', '');
		expect((await configuration()).hassUrl).toBeUndefined();
	});
});
