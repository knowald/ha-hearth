import { expect, test, type Page } from '@playwright/test';

/*
 * The import wizard against the scripted registries in fake-hass.mjs: two
 * areas on one floor, a config entity that must not land on a page, and an
 * Office entity the fixture's Office page does not show yet.
 */

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();
	await page.getByRole('button', { name: 'Edit Hearth configuration' }).click();
	// a setup-time action, so it lives in the settings sheet rather than the edit bar
	await page.getByRole('button', { name: 'Settings', exact: true }).click();
});

async function openImport(page: Page) {
	await page.getByRole('button', { name: /Import Home Assistant areas/ }).click();
	return page.getByRole('dialog', { name: 'Import Home Assistant areas' });
}

/** Applies, then leaves the tablet step the wizard ends on. */
async function applyAndFinish(page: Page) {
	await page
		.getByRole('dialog', { name: /Import Home Assistant areas|Starter layouts/ })
		.getByRole('button', { name: 'Apply' })
		.click();
	const tablet = page.getByRole('dialog', { name: 'Open on your tablet' });
	await expect(tablet).toBeVisible();
	await tablet.getByRole('button', { name: 'Done' }).click();
	await expect(tablet).toBeHidden();
}

test('proposes a page per area, grouped by floor', async ({ page }) => {
	const dialog = await openImport(page);

	await expect(dialog).toBeVisible();
	await expect(dialog.getByText('Ground floor')).toBeVisible();
	await expect(dialog.getByText('Living room', { exact: true })).toBeVisible();
	// the fixture already has an Office page, so adding pages leaves it out
	await expect(dialog.getByText('Office', { exact: true })).toHaveCount(0);
	// with one page there is nothing a replace would remove, so it is not offered
	await expect(dialog.getByRole('radio', { name: 'Replace pages' })).toHaveCount(0);
	await dialog.getByRole('radio', { name: 'Add new entities' }).click();
	await expect(dialog.getByText('Office', { exact: true })).toBeVisible();
});

test('adds the selected pages and leaves the existing one alone', async ({ page }) => {
	await openImport(page);
	await applyAndFinish(page);

	const rail = page.locator('.rail');
	await expect(rail.getByRole('button', { name: 'Living room' })).toBeVisible();
	await expect(rail.getByRole('button', { name: 'Office', exact: true })).toHaveCount(1);
});

test('keeps config entities off the imported page', async ({ page }) => {
	await openImport(page);
	await applyAndFinish(page);
	await page.locator('.rail').getByRole('button', { name: 'Living room' }).click();

	await expect(page.getByRole('button', { name: /Ceiling fan/ })).toBeVisible();
	await expect(page.getByText(/firmware/i)).toHaveCount(0);
});

test('ends on the tablet address and its QR code', async ({ page, baseURL }) => {
	const dialog = await openImport(page);
	await dialog.getByRole('button', { name: 'Apply' }).click();

	const tablet = page.getByRole('dialog', { name: 'Open on your tablet' });
	await tablet.getByLabel('Device name').fill('kitchen');
	await expect(tablet.getByText(`${baseURL}/?device=kitchen`)).toBeVisible();
	await expect(
		tablet.getByRole('img', { name: `QR code for ${baseURL}/?device=kitchen` })
	).toBeVisible();
});

test('adds only the entities a page lacks, without removing any', async ({ page }) => {
	const dialog = await openImport(page);
	await dialog.getByRole('radio', { name: 'Add new entities' }).click();
	const office = dialog.locator('.row', { hasText: 'Office' });
	await expect(office.getByText('1 new entity')).toBeVisible();
	await applyAndFinish(page);

	const lights = page.locator('.card-slot', { hasText: 'Lights' });
	for (const name of [/Desk lamp/, /Shelf lamp/, /Ceiling fan/, /Desk charger/]) {
		await expect(lights.getByRole('button', { name })).toBeVisible();
	}
	await expect(page.locator('.card-slot', { hasText: 'Readings' })).toBeVisible();
});

test('builds a starter layout from the home entities', async ({ page }) => {
	await page.getByRole('button', { name: /Starter layouts/ }).click();
	const dialog = page.getByRole('dialog', { name: 'Starter layouts' });
	await dialog.getByRole('radio', { name: /Phone remote/ }).click();
	await applyAndFinish(page);

	await page.locator('.rail').getByRole('button', { name: 'Remote' }).click();
	await expect(page.getByRole('button', { name: /Living room/ }).first()).toBeVisible();
	await expect(page.getByRole('button', { name: /Evening/ })).toBeVisible();
});
