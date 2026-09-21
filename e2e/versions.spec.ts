import { expect, test } from '@playwright/test';

/*
 * The YAML editor's file transfer and the saved versions behind it. A save is
 * what leaves a version, so each test makes one first rather than relying on
 * whatever the fixture directory has collected.
 */

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();
	await page.getByRole('button', { name: 'Edit Hearth configuration' }).click();
});

async function openYamlEditor(page: import('@playwright/test').Page) {
	await page.getByRole('button', { name: 'Settings', exact: true }).click();
	await page.getByRole('button', { name: 'Edit configuration YAML' }).click();
	return page.getByRole('dialog', { name: 'Configuration YAML' });
}

test('exports the dashboard as a YAML file', async ({ page }) => {
	const dialog = await openYamlEditor(page);
	await expect(dialog).toBeVisible();

	const download = page.waitForEvent('download');
	await dialog.getByRole('button', { name: 'Export file' }).click();

	expect((await download).suggestedFilename()).toMatch(/^hearth-\d{4}-\d{2}-\d{2}-\d{4}\.yaml$/);
});

test('loads an imported file into the editor without applying it', async ({ page }) => {
	const dialog = await openYamlEditor(page);
	const chooser = page.waitForEvent('filechooser');
	await dialog.getByRole('button', { name: 'Import file' }).click();
	await (
		await chooser
	).setFiles({
		name: 'imported.yaml',
		mimeType: 'text/yaml',
		buffer: Buffer.from(
			'version: 5\nrail:\n  - id: nav\n    type: nav\nrooms:\n  - id: den\n    name: Den\n    cards: [[]]\n'
		)
	});

	await expect(dialog.getByText('File loaded into the editor')).toBeVisible();
	await expect(dialog.locator('.cm-content')).toContainText('Den');
	// nothing reaches the dashboard until Done
	await expect(page.locator('.rail').getByRole('button', { name: 'Den' })).toHaveCount(0);

	await dialog.getByRole('button', { name: 'Done' }).click();
	await expect(page.locator('.rail').getByRole('button', { name: 'Den' })).toBeVisible();
});

test('shows a saved version against the dashboard and restores it', async ({ page }) => {
	// the save leaves the page list of this moment behind as a version
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('button', { name: 'Edit Hearth configuration' })).toBeVisible();

	await page.getByRole('button', { name: 'Edit Hearth configuration' }).click();
	await page.getByRole('button', { name: 'Settings', exact: true }).click();
	await page.getByRole('button', { name: 'Versions' }).click();

	const dialog = page.getByRole('dialog', { name: 'Versions' });
	await expect(dialog).toBeVisible();
	await expect(dialog.getByRole('option', { name: /Saved file/ })).toBeVisible();

	// the saved file heads the list; the entries under it are the snapshots
	const version = dialog.getByRole('option').filter({ hasNotText: 'Saved file' }).first();
	await expect(version).toBeVisible();
	await version.click();
	await expect(dialog.locator('.cm-content')).toContainText('rooms');

	await dialog.getByRole('button', { name: 'Restore' }).click();
	await expect(dialog).toBeHidden();
	// a restore is an edit, so it is undoable and still unsaved
	await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
});

test('an unapplied YAML edit survives the trip through Versions', async ({ page }) => {
	const dialog = await openYamlEditor(page);
	const editor = dialog.locator('.cm-content');
	await editor.click();
	await page.keyboard.type('# a note that was never applied\n');
	await expect(editor).toContainText('a note that was never applied');

	await dialog.getByRole('button', { name: 'Versions' }).click();
	const versions = page.getByRole('dialog', { name: 'Versions' });
	await expect(versions).toBeVisible();

	await versions.getByRole('button', { name: 'Back' }).click();
	const reopened = page.getByRole('dialog', { name: 'Configuration YAML' });
	await expect(reopened).toBeVisible();
	await expect(reopened.locator('.cm-content')).toContainText('a note that was never applied');
});
