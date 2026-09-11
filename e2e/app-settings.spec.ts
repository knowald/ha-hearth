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
		const prompt = page.getByRole('dialog', { name: 'Log in' });
		await expect(prompt).toBeVisible();
		const token = prompt.getByLabel('Long-lived access token');
		await expect(token).toHaveCSS('border-radius', '12px');
		await token.fill('e2e-token');
		await prompt.getByRole('button', { name: 'Done' }).click();
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
		await page.getByRole('button', { name: /Application settings/ }).click();
		const sheet = page.getByRole('dialog', { name: 'Application settings' });
		const response = page.waitForResponse(
			(response) =>
				response.url().endsWith('/_api/save_config') && response.request().method() === 'POST'
		);
		await sheet.getByRole('button', { name: 'Done' }).click();
		const saved = await response;
		expect(saved.status()).toBe(200);
		revisions.push((await saved.json()).revision);
		await expect(sheet).toBeHidden();
	}
	expect(revisions[1]).toBe(revisions[0] + 1);
});
