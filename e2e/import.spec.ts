import { expect, test } from '@playwright/test';

/*
 * The import wizard against the scripted registries in fake-hass.mjs: two
 * areas on one floor, a config entity that must not land on a page.
 */

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();
	await page.getByRole('button', { name: 'Edit Hearth configuration' }).click();
	// a setup-time action, so it lives in the settings sheet rather than the edit bar
	await page.getByRole('button', { name: 'Settings', exact: true }).click();
	await page.getByRole('button', { name: /Import Home Assistant areas/ }).click();
});

test('proposes a page per area, grouped by floor', async ({ page }) => {
	const dialog = page.getByRole('dialog', { name: 'Import Home Assistant areas' });

	await expect(dialog).toBeVisible();
	await expect(dialog.getByText('Ground floor')).toBeVisible();
	await expect(dialog.getByText('Living room', { exact: true })).toBeVisible();
	await expect(dialog.getByText('Office', { exact: true })).toBeVisible();
});

test('adds the selected pages and leaves the existing one alone', async ({ page }) => {
	const dialog = page.getByRole('dialog', { name: 'Import Home Assistant areas' });
	// the fixture already has an Office page; importing the area again would
	// duplicate it
	await dialog.getByRole('checkbox').last().uncheck();
	await dialog.getByRole('button', { name: 'Apply' }).click();

	await expect(dialog).toBeHidden();
	const rail = page.locator('.rail');
	await expect(rail.getByRole('button', { name: 'Living room' })).toBeVisible();
	await expect(rail.getByRole('button', { name: 'Office', exact: true })).toHaveCount(1);
});

test('keeps config entities off the imported page', async ({ page }) => {
	const dialog = page.getByRole('dialog', { name: 'Import Home Assistant areas' });
	await dialog.getByRole('button', { name: 'Apply' }).click();
	await page.locator('.rail').getByRole('button', { name: 'Living room' }).click();

	await expect(page.getByRole('button', { name: /Ceiling fan/ })).toBeVisible();
	await expect(page.getByText(/firmware/i)).toHaveCount(0);
});
