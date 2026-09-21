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
		headers: ingress
			? {
					'X-Hass-Source': 'core.ingress',
					'X-Forwarded-Proto': 'https',
					'X-Forwarded-Host': 'example.ui.nabu.casa'
				}
			: {}
	});
	return (await load({ request } as Parameters<typeof load>[0])).configuration;
}

describe('browser Home Assistant URL', () => {
	it('uses the forwarded Home Assistant origin under Ingress instead of the internal server address', async () => {
		expect((await configuration(true)).hassUrl).toBe('https://example.ui.nabu.casa');
		expect(process.env.HASS_URL).toBe('http://homeassistant:8123');
	});

	it('preserves the configured URL for direct access', async () => {
		expect((await configuration()).hassUrl).toBe('http://homeassistant:8123');
	});

	it.each([true, false])(
		'uses Ingress origin before the direct-access public URL (Ingress: %s)',
		async (ingress) => {
			vi.stubEnv('HASS_PUBLIC_URL', 'https://ha.example.com');
			expect((await configuration(ingress)).hassUrl).toBe(
				ingress ? 'https://example.ui.nabu.casa' : 'https://ha.example.com'
			);
			expect(process.env.HASS_URL).toBe('http://homeassistant:8123');
		}
	);

	it('keeps the missing configuration state for standalone access', async () => {
		vi.stubEnv('HASS_URL', '');
		expect((await configuration()).hassUrl).toBeUndefined();
	});
});
