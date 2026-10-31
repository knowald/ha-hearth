import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';

/* The one Settings sheet: its section list, search, change counts and server save. */

const CONFIG_FILE = new URL('./fixture/data/configuration.yaml', import.meta.url);
const CONFIG_FIXTURE = readFileSync(CONFIG_FILE, 'utf8');

test.afterEach(() => writeFileSync(CONFIG_FILE, CONFIG_FIXTURE));

const sections = (sheet: Locator) => sheet.getByRole('navigation', { name: 'Settings sections' });

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
	await expect(sheet.getByRole('heading', { name: 'Size and spacing' })).toBeHidden();
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

test('closes from its one close button, with each row beside its control', async ({ page }) => {
	const sheet = await openSettings(page);
	await expect(sheet.getByText('Changes apply right away.')).toBeVisible();
	await expect(sheet.getByRole('button', { name: 'Close', exact: true })).toHaveCount(1);
	await expect(sheet.getByRole('button', { name: 'Done' })).toHaveCount(0);

	// the label on the left, the control in its own column on the right
	const row = sheet
		.locator('.row')
		.filter({ has: page.getByLabel('Sleep screen turns on') })
		.first();
	const sleep = row.getByLabel('Sleep screen turns on');
	const label = (await row.locator('.row-label').boundingBox())!;
	const control = (await sleep.boundingBox())!;
	expect(control.x).toBeGreaterThan(label.x + label.width);
	expect(Math.abs(control.y + control.height / 2 - (label.y + label.height / 2))).toBeLessThan(24);

	// the presence sensor is a row like the others
	const presenceRow = sheet
		.locator('.row')
		.filter({ has: page.getByLabel('Presence sensor', { exact: true }) });
	const presence = presenceRow.getByLabel('Presence sensor', { exact: true });
	await expect(presenceRow.locator('.row-label')).toHaveText('Presence sensor');
	const presenceBox = (await presence.boundingBox())!;
	const presenceLabel = (await presenceRow.locator('.row-label').boundingBox())!;
	expect(presenceBox.x).toBeGreaterThan(presenceLabel.x + presenceLabel.width);

	await sheet.getByRole('button', { name: 'Close', exact: true }).click();
	await expect(sheet).toBeHidden();
});

test('tags an inherited value and resets an override to it', async ({ page }) => {
	const sheet = await openSettings(page);
	const row = sheet
		.locator('.row')
		.filter({ has: page.getByRole('combobox', { name: 'Interface scale', exact: true }) });
	const scale = row.getByRole('combobox');
	await expect(scale).toHaveValue('100');
	await expect(row.locator('.row-tag')).toHaveText('Dashboard');
	await expect(row.getByRole('button', { name: /^Reset to/ })).toHaveCount(0);

	await scale.selectOption('120');
	await expect(row.locator('.row-tag')).toHaveText('This screen');
	await expect(sections(sheet).getByRole('button', { name: /This screen/ })).toContainText('1');
	expect(await page.evaluate(() => localStorage.getItem('hearthScreen'))).toBe('{"scale":120}');

	await row.getByRole('button', { name: 'Reset to dashboard (100%)' }).click();
	await expect(scale).toHaveValue('100');
	await expect(scale).toBeFocused();
	await expect(row.locator('.row-tag')).toHaveText('Dashboard');
	expect(await page.evaluate(() => localStorage.getItem('hearthScreen'))).toBeNull();
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

	test('puts a wide control under its label and keeps a switch beside it', async ({ page }) => {
		const sheet = await openSettings(page);
		const sleepRow = sheet
			.locator('.row')
			.filter({ has: page.getByLabel('Sleep screen turns on') })
			.first();
		const sleep = sleepRow.getByLabel('Sleep screen turns on');
		const sleepLabel = sleepRow.locator('.row-label');
		expect((await sleep.boundingBox())!.y).toBeGreaterThan(
			(await sleepLabel.boundingBox())!.y + 10
		);
		const shiftRow = sheet
			.locator('.row')
			.filter({ has: page.getByRole('switch', { name: 'Pixel shifting' }) });
		const shift = shiftRow.getByRole('switch');
		const shiftLabel = shiftRow.locator('.row-label');
		const shiftBox = (await shift.boundingBox())!;
		expect(shiftBox.x).toBeGreaterThan((await shiftLabel.boundingBox())!.x + 100);
		const width = await page.evaluate(() => document.documentElement.scrollWidth);
		expect(width).toBeLessThanOrEqual(390);
	});
});

test.describe('the smallest phone, in a longer language', () => {
	test.use({ viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true });

	test('keeps the sheet and the server buttons on screen', async ({ page }) => {
		await page.addInitScript(() =>
			localStorage.setItem('hearthScreen', JSON.stringify({ locale: 'de' }))
		);
		await page.goto('/');
		await page.locator('.edit-toggle').click();
		await page.getByRole('button', { name: 'Einstellungen', exact: true }).click();
		const sheet = page.getByRole('dialog').first();
		await expect(sheet).toBeVisible();
		// any server switch stages a change, which brings up Save and Discard
		await sheet.locator('[data-section="server"] [role="switch"]').last().click();
		const buttons = sheet.locator('.footer-actions button');
		await expect(buttons).toHaveCount(2);

		const box = (await sheet.boundingBox())!;
		expect(box.x).toBeGreaterThanOrEqual(0);
		expect(box.x + box.width).toBeLessThanOrEqual(320);
		for (const button of await buttons.all()) {
			const edges = (await button.boundingBox())!;
			expect(edges.x).toBeGreaterThanOrEqual(box.x);
			expect(edges.x + edges.width).toBeLessThanOrEqual(box.x + box.width);
			expect(await button.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
		}
	});
});
