import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/*
 * Home Assistant's strings and Hearth's own live in separate files per
 * locale; the server merges them over English. The suite runs the build,
 * whose copy of a Hearth locale file is swapped here to show it is read.
 */

const HEARTH_GERMAN = new URL('../build/client/translations/hearth/de.json', import.meta.url);
const HEARTH_GERMAN_FILE = readFileSync(HEARTH_GERMAN, 'utf8');

test.afterEach(() => writeFileSync(HEARTH_GERMAN, HEARTH_GERMAN_FILE));

async function openThisScreen(page: Page) {
	await page.goto('/');
	await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();
	await page.getByRole('button', { name: 'This screen' }).click();
	return page.getByRole('dialog', { name: 'This screen' });
}

test('offers exactly the locales Home Assistant ships', async ({ request }) => {
	const response = await request.get('/_api/list_languages');
	const shipped = readdirSync(new URL('../static/translations/', import.meta.url))
		.filter((name) => name.endsWith('.json'))
		.map((name) => name.slice(0, -'.json'.length))
		.sort();
	expect(await response.json()).toEqual(shipped);
});

test('refuses a locale outside the shipped list', async ({ request }) => {
	for (const locale of ['xx', '../en', 'hearth/en']) {
		const response = await request.post('/_api/get_translation', { data: { locale } });
		expect(response.status()).toBe(500);
	}
});

test('a language switch reads both files and falls back to English per key', async ({ page }) => {
	const sheet = await openThisScreen(page);
	await sheet.getByLabel('Language').selectOption('de');
	await expect(page.locator('html')).toHaveAttribute('lang', 'de');
	// Home Assistant's German, next to Hearth copy German does not have yet
	await expect(sheet.getByLabel('Sprache')).toBeVisible();
	await expect(sheet.getByLabel('Keep screen awake')).toBeVisible();

	writeFileSync(
		HEARTH_GERMAN,
		JSON.stringify({ hearth_keep_screen_awake: 'Bildschirm wach halten' })
	);
	await page.reload();
	await page.getByRole('button', { name: 'This screen' }).click();
	await expect(sheet.getByLabel('Bildschirm wach halten')).toBeVisible();
	await expect(sheet.getByLabel('Sprache')).toBeVisible();
});
