import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/*
 * Home Assistant's strings and Hearth's own live in separate files per
 * locale; the server merges them over English, which sits under _default.
 */

const SETTINGS_FILE = new URL('./fixture/data/configuration.yaml', import.meta.url);
const SETTINGS_FIXTURE = readFileSync(SETTINGS_FILE, 'utf8');

test.afterEach(() => writeFileSync(SETTINGS_FILE, SETTINGS_FIXTURE));

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
	for (const locale of ['xx', '../en', 'hearth/en', 'constructor']) {
		const response = await request.post('/_api/get_translation', { data: { locale } });
		expect(response.status()).toBe(400);
	}
	const response = await request.post('/_api/get_translation', { data: {} });
	expect(response.status()).toBe(400);
});

test('serves a locale with both English files beneath it', async ({ request }) => {
	const response = await request.post('/_api/get_translation', { data: { locale: 'de' } });
	const german = await response.json();
	expect(german.language).toBe('Sprache');
	expect(german._default.language).toBe('Language');
	expect(german._default.hearth_keep_screen_awake).toBe('Keep screen awake');
});

test('a language switch falls back to English per key', async ({ page }) => {
	// drops one German key, as a locale that has not caught up with English yet would
	await page.route('**/_api/get_translation', async (route) => {
		const response = await route.fetch();
		const body = await response.json();
		delete body.hearth_reduce_motion;
		await route.fulfill({ response, json: body });
	});
	const sheet = await openThisScreen(page);
	await sheet.getByLabel('Language').selectOption('de');
	await expect(page.locator('html')).toHaveAttribute('lang', 'de');
	// the sheet title is translated too, so find it by its German name
	const german = page.getByRole('dialog', { name: 'Dieser Bildschirm' });
	await expect(german.getByLabel('Sprache')).toBeVisible();
	await expect(german.getByLabel('Bildschirm wach halten')).toBeVisible();
	// Hearth copy the locale lacks stays English
	await expect(german.getByLabel('Reduce motion')).toBeVisible();
});

test('the error page loads its copy from the Hearth file', async ({ page }) => {
	const response = await page.goto('/no-such-page');
	expect(response?.status()).toBe(404);
	await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Return to Hearth' })).toBeVisible();
});

test('an unknown configured locale shows English and says so', async ({ page }) => {
	writeFileSync(SETTINGS_FILE, SETTINGS_FIXTURE.replace('locale: en', 'locale: xx'));
	await page.goto('/');
	await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	await expect(page.getByRole('button', { name: 'This screen' })).toBeVisible();
});
