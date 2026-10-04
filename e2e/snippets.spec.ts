import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/*
 * Single items as YAML: a card edited in its YAML view, a card copied from
 * one page and pasted onto another, and a theme exported and imported.
 */

const HEARTH_FILE = new URL('./fixture/data/hearth.yaml', import.meta.url);
const HEARTH_FIXTURE = readFileSync(HEARTH_FILE, 'utf8');

function writeFixture() {
	writeFileSync(
		HEARTH_FILE,
		`version: 5
revision: 1
rail:
  - id: clock
    type: clock
  - id: nav
    type: nav
rooms:
  - id: office
    name: Office
    icon: desk
    columns: 1
    cards:
      - - id: lights
          type: entities
          title: Lights
          entities:
            - entity: light.desk
            - entity: light.shelf
        - id: readings
          type: entities
          title: Readings
          style: stat
          entities:
            - entity: sensor.temperature
  - id: kitchen
    name: Kitchen
    icon: kitchen
    columns: 1
    cards:
      - []
`
	);
}

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });
test.beforeEach(() => writeFixture());
test.afterEach(() => writeFileSync(HEARTH_FILE, HEARTH_FIXTURE));

async function startEditing(page: Page) {
	await page.goto('/');
	await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();
	await page.getByRole('button', { name: 'Edit Hearth configuration' }).click();
	await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
}

async function replaceCode(page: Page, sheet: ReturnType<Page['getByRole']>, text: string) {
	await sheet.locator('.cm-content').click();
	await page.keyboard.press('ControlOrMeta+a');
	await page.keyboard.insertText(text);
}

test('a card edited as YAML takes an option the form has no field for', async ({ page }) => {
	await startEditing(page);
	const readings = page.locator('.card-slot[data-id="readings"]');
	await expect(readings.locator('.stat-verdict')).toHaveCount(0);

	await page.getByRole('button', { name: 'Edit Readings', exact: true }).click();
	const sheet = page.getByRole('dialog', { name: 'Edit card' });
	await sheet.getByRole('button', { name: 'YAML', exact: true }).click();
	await expect(sheet.locator('.cm-content')).toContainText('id: readings');

	// a broken document holds Done and the way back to the form
	await replaceCode(page, sheet, 'id: readings\ntype: entities\nentities: [\n');
	await expect(sheet.getByRole('alert')).toContainText('Line');
	await expect(sheet.getByRole('button', { name: 'Done' })).toBeDisabled();
	await expect(sheet.getByRole('button', { name: 'Form', exact: true })).toBeDisabled();

	await replaceCode(
		page,
		sheet,
		`id: readings
type: entities
title: Readings
style: stat
entities:
  - entity: sensor.temperature
    verdict:
      good: 18
      fair: 26
`
	);
	await expect(sheet.getByRole('button', { name: 'Done' })).toBeEnabled();
	await sheet.getByRole('button', { name: 'Done' }).click();
	await expect(sheet).toBeHidden();
	// 21.5 sits between the bands
	await expect(readings.locator('.stat-verdict')).toHaveAttribute('data-tone', 'fair');
});

test('a card copied as YAML pastes onto another page with a new id', async ({ page }) => {
	await startEditing(page);
	await page.getByRole('button', { name: 'Edit Lights', exact: true }).click();
	const edit = page.getByRole('dialog', { name: 'Edit card' });
	await edit.getByRole('button', { name: 'Copy as YAML' }).click();
	await expect(page.getByText('Copied', { exact: true })).toBeVisible();
	const copied = await page.evaluate(() => navigator.clipboard.readText());
	expect(copied).toContain('id: lights');
	await page.keyboard.press('Escape');
	await expect(edit).toBeHidden();

	await page
		.locator('.room-list')
		.getByRole('button', { name: /Kitchen/ })
		.click();
	await page.getByRole('button', { name: 'Add card' }).first().click();
	const add = page.getByRole('dialog', { name: 'Add card' });
	await add.getByRole('button', { name: 'Paste YAML' }).click();
	await add.getByRole('button', { name: 'Paste from clipboard' }).click();
	await expect(add).toBeHidden();

	const pasted = page.locator('.card-slot').filter({ hasText: 'Lights' });
	await expect(pasted).toHaveCount(1);
	await expect(pasted).toHaveAttribute('data-id', 'entities');
	await expect(pasted.locator('.entity-slot')).toHaveCount(2);
});

test('a theme exported as YAML imports again', async ({ page }) => {
	await startEditing(page);
	await page.getByRole('button', { name: 'Theme' }).click();
	const sheet = page.getByRole('dialog', { name: 'Theme' });
	const frame = page.locator('.frame');

	await sheet.getByRole('button', { name: /^Accent/ }).click();
	await sheet.locator('.hex input').fill('3366ff');
	await sheet.locator('.hex input').blur();
	await expect(frame).toHaveCSS('--h-accent-rgb', '51 102 255');

	const download = page.waitForEvent('download');
	await sheet.getByRole('button', { name: 'Download' }).click();
	expect((await download).suggestedFilename()).toBe('hearth-theme-day.yaml');
	await sheet.getByRole('button', { name: 'Copy as YAML' }).click();
	const exported = await page.evaluate(() => navigator.clipboard.readText());
	expect(exported).toContain('accent:');

	await sheet.getByRole('button', { name: 'Reset the day theme to defaults' }).click();
	await expect(frame).not.toHaveCSS('--h-accent-rgb', '51 102 255');

	await sheet.getByRole('button', { name: 'Import' }).click();
	await sheet.getByLabel('Theme YAML').fill('theme:\n  accent: 12\n');
	await expect(sheet.getByRole('alert')).toContainText('accent must be text');
	await expect(sheet.getByRole('button', { name: 'Apply' })).toBeDisabled();

	await sheet.getByLabel('Theme YAML').fill(exported);
	await expect(sheet.locator('.import-preview')).toBeVisible();
	await sheet.getByRole('button', { name: 'Apply' }).click();
	await expect(frame).toHaveCSS('--h-accent-rgb', '51 102 255');

	// the import is one step in the history
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(frame).not.toHaveCSS('--h-accent-rgb', '51 102 255');
});
