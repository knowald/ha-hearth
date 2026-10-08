import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const file = new URL('./fixture/data/configuration.yaml', import.meta.url);
const fixture = readFileSync(file, 'utf8');

test.afterEach(() => writeFileSync(file, fixture));

test.describe('companion app authentication', () => {
	test.use({ userAgent: 'Home Assistant' });
	test('saves a token in the Hearth prompt and connects', async ({ page }) => {
		writeFileSync(file, fixture.replace(/^token:.*\n/m, ''));
		await page.goto('/');
		const prompt = page.getByRole('dialog', { name: 'Sign in' });
		await expect(prompt).toBeVisible();
		const token = prompt.getByLabel('Long-lived access token');
		await expect(token).toHaveCSS('border-radius', '12px');
		await token.fill('e2e-token');
		await prompt.getByRole('button', { name: 'Sign in' }).click();
		await expect(prompt).toBeHidden();
		await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();
	});
});

test('two application settings saves use successive revisions', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Edit Hearth configuration' }).click();
	const revisions: number[] = [];
	for (let i = 0; i < 2; i++) {
		await page.getByRole('button', { name: 'Settings', exact: true }).click();
		await page.getByRole('button', { name: /Server settings/ }).click();
		const sheet = page.getByRole('dialog', { name: 'Server settings' });
		const response = page.waitForResponse(
			(response) =>
				response.url().endsWith('/_api/save_config') && response.request().method() === 'POST'
		);
		await sheet.getByRole('button', { name: 'Save' }).click();
		const saved = await response;
		expect(saved.status()).toBe(200);
		revisions.push((await saved.json()).revision);
		await expect(sheet).toBeHidden();
	}
	expect(revisions[1]).toBe(revisions[0] + 1);
});

test.describe('write access', () => {
	const FAKE_HASS = `http://127.0.0.1:${process.env.E2E_HASS_PORT ?? 8124}`;
	test.afterEach(async ({ request }) => {
		await request.post(`${FAKE_HASS}/_test/user`, { data: { is_admin: true } });
	});

	test('the server refuses writes without a Home Assistant token', async ({ request }) => {
		for (const path of ['/_api/save_hearth', '/_api/save_config', '/_api/custom_css']) {
			expect((await request.post(path, { data: { revision: 0 } })).status()).toBe(401);
		}
		// reads stay open for screens without a session
		expect((await request.get('/_api/custom_css')).status()).toBe(200);
	});

	test('a regular Home Assistant user cannot save server settings', async ({ page, request }) => {
		await request.post(`${FAKE_HASS}/_test/user`, { data: { is_admin: false } });
		// a token of its own, since the server remembers who the fixture token belongs to
		const regular = fixture.replace(/^token:.*$/m, 'token: e2e-regular-user-token');
		writeFileSync(file, regular);
		await page.goto('/');
		await page.getByRole('button', { name: 'Edit Hearth configuration' }).click();
		await page.getByRole('button', { name: 'Settings', exact: true }).click();
		await page.getByRole('button', { name: /Server settings/ }).click();
		const sheet = page.getByRole('dialog', { name: 'Server settings' });
		const before = readFileSync(file, 'utf8');
		const response = page.waitForResponse((response) =>
			response.url().endsWith('/_api/save_config')
		);
		await sheet.getByRole('button', { name: 'Save' }).click();
		expect((await response).status()).toBe(403);
		await expect(
			sheet.getByText('Only a Home Assistant administrator can save this')
		).toBeVisible();
		expect(readFileSync(file, 'utf8')).toBe(before);
	});

	test('an administrator signed in on this browser saves over a regular stored token', async ({
		page,
		request
	}) => {
		await request.post(`${FAKE_HASS}/_test/user`, {
			data: { is_admin: false, admins: ['e2e-administrator-session'] }
		});
		writeFileSync(file, fixture.replace(/^token:.*$/m, 'token: e2e-regular-user-token'));
		// an OAuth sign-in from before the token was stored
		await page.addInitScript((hassUrl) => {
			localStorage.hearthTokens = JSON.stringify({
				hassUrl,
				clientId: `${location.origin}/`,
				access_token: 'e2e-administrator-session',
				refresh_token: 'e2e-refresh',
				expires: Date.now() + 3_600_000,
				expires_in: 3600
			});
		}, FAKE_HASS);
		await page.goto('/');
		await page.getByRole('button', { name: 'Edit Hearth configuration' }).click();
		await page.getByRole('button', { name: 'Settings', exact: true }).click();
		await page.getByRole('button', { name: /Server settings/ }).click();
		const sheet = page.getByRole('dialog', { name: 'Server settings' });
		const response = page.waitForResponse((response) =>
			response.url().endsWith('/_api/save_config')
		);
		await sheet.getByRole('button', { name: 'Save' }).click();
		const saved = await response;
		expect(saved.status()).toBe(200);
		expect(saved.request().headers().authorization).toBe('Bearer e2e-administrator-session');
		await expect(sheet).toBeHidden();
	});
});
