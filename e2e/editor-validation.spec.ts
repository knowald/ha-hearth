import { expect, test } from '@playwright/test';

/*
 * Editor validation and the entity picker: a card that cannot work without an
 * entity keeps Done disabled and says why, list editors take several picks at
 * once, and the picker searches the registry's areas.
 */

const FAKE_HASS = `http://127.0.0.1:${process.env.E2E_HASS_PORT ?? 8124}`;

test.beforeEach(async ({ page, request }) => {
	await request.post(`${FAKE_HASS}/_test/reset`);
	await page.goto('/');
	await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();
	await page.evaluate(() => localStorage.removeItem('hearthRecentEntities'));
	await page.getByRole('button', { name: 'Edit Hearth configuration' }).click();
});

test('a climate card without an entity keeps Done disabled and says why', async ({ page }) => {
	await page.getByRole('button', { name: 'Add card' }).click();
	const sheet = page.getByRole('dialog', { name: 'Add card' });
	await sheet.getByRole('option', { name: /^Climate\b/ }).click();

	const done = sheet.getByRole('button', { name: 'Done' });
	const entity = sheet.getByRole('combobox', { name: 'Entity', exact: true });
	await expect(entity).toHaveAttribute('aria-required', 'true');
	await expect(done).toBeDisabled();
	await expect(sheet.getByText('Entity is required')).toBeVisible();
	await expect(done).toHaveAccessibleDescription('Entity is required');

	// a typed id the dashboard does not know warns but does not block
	await entity.fill('climate.attic');
	await entity.press('Tab');
	await expect(
		sheet.getByText('Home Assistant does not report this entity. It may be offline or renamed.')
	).toBeVisible();
	await expect(done).toBeEnabled();

	await entity.fill('climate.living');
	await entity.press('Tab');
	await expect(
		sheet.getByText('Home Assistant does not report this entity. It may be offline or renamed.')
	).toBeHidden();
	await expect(sheet.getByText('Entity is required')).toBeHidden();
	await done.click();
	await expect(sheet).toBeHidden();
});

test('several picked entities land on an entities card in order', async ({ page }) => {
	await page
		.locator('.card-slot', { hasText: 'Lights' })
		.getByRole('button', { name: 'Edit' })
		.click();
	const sheet = page.getByRole('dialog', { name: 'Edit card' });
	await sheet.getByRole('button', { name: 'Pick several entities' }).click();

	const picker = page.getByRole('dialog', { name: 'Choose an entity' });
	await picker.getByRole('option', { name: /Space heater/ }).click();
	await picker.getByRole('option', { name: /Bedroom fan/ }).click();
	await expect(picker.getByRole('status')).toHaveText('2 picked');
	await picker.getByRole('button', { name: 'Add picked' }).click();
	await expect(picker).toBeHidden();

	const rows = sheet.locator('.entity-row-toggle');
	await expect(rows.nth(-2)).toContainText('switch.heater');
	await expect(rows.nth(-1)).toContainText('fan.bedroom');
	await expect(sheet.locator('.preview').getByText('Space heater')).toBeVisible();
});

test('the picker finds an entity by its area name', async ({ page }) => {
	await page.getByRole('button', { name: 'Add widget' }).first().click();
	const sheet = page.getByRole('dialog', { name: 'Add widget' });
	await sheet.getByRole('option', { name: /^Entity\b/ }).click();
	await sheet.getByRole('button', { name: 'Choose an entity' }).click();

	const picker = page.getByRole('dialog', { name: 'Choose an entity' });
	await picker.getByRole('combobox', { name: 'Search entities' }).fill('office');
	const options = picker.getByRole('option');
	await expect(options).toHaveCount(1);
	await expect(options.first()).toContainText('Desk lamp');
	await expect(options.first()).toContainText('Office');
	await options.first().click();
	await expect(picker).toBeHidden();

	// the picked entity shows its name and state under the id
	await expect(sheet.locator('.entity-details')).toContainText('Desk lamp');
	await expect(sheet.getByRole('button', { name: 'Done' })).toBeEnabled();
});
