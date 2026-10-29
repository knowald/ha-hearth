import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/* The one Settings sheet: its section list, search, change counts and server save. */

const CONFIG_FILE = new URL('./fixture/data/configuration.yaml', import.meta.url);
const CONFIG_FIXTURE = readFileSync(CONFIG_FILE, 'utf8');

test.afterEach(() => writeFileSync(CONFIG_FILE, CONFIG_FIXTURE));

async function openSettings(page: Page) {
	await page.goto('/');
	await page.getByRole('button', { name: 'Edit Hearth configuration' }).click();
	await page.getByRole('button', { name: 'Settings', exact: true }).click();
	const sheet = page.getByRole('dialog', { name: 'Settings' });
	await expect(sheet).toBeVisible();
	return sheet;
}

test('searches, jumps between sections and counts dashboard changes', async ({ page }) => {
	const sheet = await openSettings(page);
	const sections = sheet.getByRole('navigation', { name: 'Settings sections' });
	const search = sheet.getByRole('searchbox', { name: 'Search settings' });

	await search.fill('tile anim');
	await expect(sheet.getByRole('switch', { name: 'Tile animations' })).toBeVisible();
	await expect(sheet.getByRole('heading', { name: 'Appearance' })).toBeVisible();
	await expect(sheet.getByRole('heading', { name: 'Wall display' })).toBeHidden();
	await expect(sheet.getByRole('switch', { name: 'Scroll edge blur' })).toHaveCount(0);

	// Escape clears a search before it closes anything
	await search.press('Escape');
	await expect(search).toHaveValue('');
	await expect(sheet).toBeVisible();

	await search.fill('nothing like this');
	await expect(sheet.getByRole('status').filter({ hasText: 'No matches' })).toBeVisible();

	// a picked section clears the search and scrolls into view
	await sections.getByRole('button', { name: 'Alerts' }).click();
	await expect(search).toHaveValue('');
	await expect(sections.getByRole('button', { name: 'Alerts' })).toHaveAttribute(
		'aria-current',
		'true'
	);
	await expect(sheet.getByRole('heading', { name: 'Alerts' })).toBeInViewport();

	await sections.getByRole('button', { name: 'Appearance' }).click();
	await sheet.getByRole('switch', { name: 'Tile animations' }).click();
	await expect(
		sheet.getByText('1 dashboard change, kept when you choose Save in the edit bar')
	).toBeVisible();
	await expect(sections.getByRole('button', { name: /Appearance/ })).toContainText('1');
});

test('saves a server setting from the footer and stays open', async ({ page }) => {
	const sheet = await openSettings(page);
	await sheet
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Server settings' })
		.click();
	const server = sheet.locator('[data-section="server"]');
	await expect(sheet.getByRole('button', { name: 'Save server settings' })).toHaveCount(0);

	await server.getByRole('switch', { name: 'Custom JavaScript' }).click();
	await expect(sheet.getByText('1 unsaved server setting')).toBeVisible();
	const response = page.waitForResponse(
		(response) =>
			response.url().endsWith('/_api/save_config') && response.request().method() === 'POST'
	);
	await sheet.getByRole('button', { name: 'Save server settings' }).click();
	expect((await response).status()).toBe(200);
	await expect(sheet.getByText('Server settings saved to configuration.yaml')).toBeVisible();
	await expect(sheet.getByRole('button', { name: 'Save server settings' })).toHaveCount(0);
	expect(readFileSync(CONFIG_FILE, 'utf8')).toMatch(/^custom_js: true$/m);
	await expect(sheet).toBeVisible();
});

test('asks before closing over unsaved server settings', async ({ page }) => {
	const sheet = await openSettings(page);
	await sheet
		.locator('[data-section="server"]')
		.getByRole('switch', { name: 'Custom JavaScript' })
		.click();
	await page.keyboard.press('Escape');
	const confirm = page.getByRole('alertdialog');
	await expect(confirm).toBeVisible();
	await confirm.getByRole('button', { name: 'Discard' }).click();
	await expect(sheet).toBeHidden();
	expect(readFileSync(CONFIG_FILE, 'utf8')).toBe(CONFIG_FIXTURE);
});

test.describe('phone', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

	test('lists the sections as a row of buttons over the settings', async ({ page }) => {
		const sheet = await openSettings(page);
		const sections = sheet.getByRole('navigation', { name: 'Settings sections' });
		await sections.getByRole('button', { name: 'Server settings' }).click();
		await expect(sheet.getByRole('heading', { name: 'Server settings' })).toBeInViewport();
		await expect(sections.getByRole('button', { name: 'Server settings' })).toBeInViewport();
		const width = await page.evaluate(() => document.documentElement.scrollWidth);
		expect(width).toBeLessThanOrEqual(390);
	});
});
