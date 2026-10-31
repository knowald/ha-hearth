import { expect, test } from '@playwright/test';

/*
 * The add-card gallery: grouped types beside a preview of the selected one,
 * built from the page and Home Assistant, and one action that goes on to the
 * type's fields with that card as the start.
 */

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();
	await page.getByRole('button', { name: 'Edit Hearth configuration' }).click();
	await page.getByRole('button', { name: 'Add card' }).click();
});

test('groups the types and previews the selected one', async ({ page }) => {
	const sheet = page.getByRole('dialog', { name: 'Add card' });
	await expect(sheet.getByText('to Office', { exact: true })).toBeVisible();
	// the preview pane's action is the only one; Done waits for the fields
	await expect(sheet.getByRole('button', { name: 'Done' })).toHaveCount(0);
	await expect(sheet.getByRole('button', { name: 'Paste YAML' })).toBeVisible();

	for (const group of ['Devices', 'Information', 'Media']) {
		await expect(sheet.getByRole('group', { name: group })).toBeVisible();
	}
	await expect(
		sheet.getByRole('group', { name: 'Devices' }).getByRole('option', { name: /^Climate\b/ })
	).toBeVisible();

	// the field's border is its one focus mark; the input inside draws no ring
	const search = sheet.getByRole('textbox', { name: 'Search card types' });
	await search.focus();
	await expect(search).toHaveCSS('outline-style', 'none');

	await sheet.getByRole('option', { name: /^Climate\b/ }).click();
	await expect(sheet.getByRole('option', { name: /^Climate\b/ })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	const preview = sheet.locator('.aside');
	await expect(preview).toContainText('Climate');
	await expect(preview.locator('.draft-preview')).toContainText('Target');

	await sheet.getByRole('button', { name: 'Add to Office' }).click();
	await expect(sheet.getByRole('button', { name: /Card type/ })).toBeVisible();
	await expect(sheet.getByRole('combobox', { name: 'Entity', exact: true })).toHaveValue(
		/^climate\./
	);
	await sheet.getByRole('button', { name: /^Add to / }).click();
	await expect(sheet).toBeHidden();
	await expect(page.locator('.card-slot')).toHaveCount(3);
});

test('Enter on a type goes straight on to its fields', async ({ page }) => {
	const sheet = page.getByRole('dialog', { name: 'Add card' });
	const scenes = sheet.getByRole('option', { name: /^Scenes\b/ });
	await scenes.focus();
	await scenes.press('Enter');
	await expect(sheet.getByRole('button', { name: /Card type/ })).toContainText('Scenes');
	await expect(sheet.getByRole('button', { name: /^Add to / })).toBeEnabled();
});

test('a type with nothing to start from says what the next step asks', async ({ page }) => {
	const sheet = page.getByRole('dialog', { name: 'Add card' });
	await sheet.getByRole('textbox', { name: 'Search card types' }).fill('web');
	await expect(sheet.getByRole('group', { name: 'Devices' })).toHaveCount(0);
	await sheet.getByRole('option', { name: /^Web page\b/ }).click();
	await expect(sheet.getByText('Choose what it shows in the next step.')).toBeVisible();
	await expect(sheet.locator('.aside').getByText('Configure Web page')).toBeVisible();
});
