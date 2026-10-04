import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/* Settings one screen keeps for itself, and the lock in front of edit mode. */

const HEARTH_FILE = new URL('./fixture/data/hearth.yaml', import.meta.url);
const HEARTH_FIXTURE = readFileSync(HEARTH_FILE, 'utf8');

async function open(page: Page, path = '/') {
	await page.goto(path);
	await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();
}

const sleepScreen = (page: Page) => page.getByRole('button', { name: 'Dismiss sleep screen' });
const editBarSave = (page: Page) => page.getByRole('button', { name: 'Save', exact: true });

test.afterEach(() => writeFileSync(HEARTH_FILE, HEARTH_FIXTURE));

test.describe('phone', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

	test('a phone that turned the sleep screen off stays awake past the shared delay', async ({
		page
	}) => {
		writeFileSync(HEARTH_FILE, `${HEARTH_FIXTURE}screensaver_minutes: 1\n`);
		await page.addInitScript(() => {
			if (!sessionStorage.getItem('seeded')) {
				localStorage.setItem('hearthScreen', JSON.stringify({ screensaver_minutes: 0 }));
				sessionStorage.setItem('seeded', '1');
			}
		});
		await page.clock.install();
		await open(page);
		await page.clock.fastForward('01:30');
		await expect(sleepScreen(page)).toHaveCount(0);

		// handing the choice back to the dashboard arms the shared delay again
		await page.getByRole('button', { name: 'This screen' }).click();
		const sheet = page.getByRole('dialog', { name: 'This screen' });
		await sheet.getByLabel('Sleep screen turns on').selectOption('');
		await sheet.getByRole('button', { name: 'Close' }).first().click();
		await expect(sheet).toBeHidden();
		await page.clock.fastForward('01:30');
		await expect(sleepScreen(page)).toBeVisible();
	});
});

test('This screen opens without edit mode and keeps its choices in this browser', async ({
	page
}) => {
	await open(page);
	await page.getByRole('button', { name: 'This screen' }).click();
	const sheet = page.getByRole('dialog', { name: 'This screen' });
	await expect(sheet.getByText('Stored in this browser only')).toBeVisible();
	await expect(editBarSave(page)).toHaveCount(0);
	await sheet.getByLabel('Keep screen awake').selectOption('off');
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
	// a closed sheet takes its history entry back with history.back() a task
	// later (see ui/layers.ts); a reload started before that traversal lands
	// is aborted by it
	await page.waitForFunction(() => !history.state?.hearthLayer);

	await page.reload();
	await page.getByRole('button', { name: 'This screen' }).click();
	await expect(sheet.getByLabel('Keep screen awake')).toHaveValue('off');
	expect(await page.evaluate(() => localStorage.getItem('hearthScreen'))).toBe(
		'{"keep_screen_on":false}'
	);
});

test('a held corner opens This screen when ?menu=false hides the toggle', async ({ page }) => {
	await open(page, '/?menu=false');
	await expect(page.getByRole('button', { name: 'Edit Hearth configuration' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'This screen' })).toHaveCount(0);
	const viewport = page.viewportSize()!;
	await page.mouse.move(8, viewport.height - 8);
	await page.mouse.down();
	await page.mouse.up();
	await expect(page.getByRole('dialog', { name: 'This screen' })).toHaveCount(0);

	await page.mouse.down();
	await page.waitForTimeout(2300);
	await page.mouse.up();
	await expect(page.getByRole('dialog', { name: 'This screen' })).toBeVisible();
});

test.describe('edit lock', () => {
	test('hold asks for a 2-second press before edit mode', async ({ page }) => {
		writeFileSync(HEARTH_FILE, `${HEARTH_FIXTURE}edit_lock: hold\n`);
		await open(page);
		const toggle = page.getByRole('button', { name: 'Edit Hearth configuration' });
		await toggle.click();
		await expect(toggle).toContainText('Hold for 2 seconds to edit');
		await expect(editBarSave(page)).toHaveCount(0);

		await toggle.hover();
		await page.mouse.down();
		await page.waitForTimeout(2300);
		await page.mouse.up();
		await expect(editBarSave(page)).toBeVisible();
	});

	test('a PIN lock opens edit mode only for the right PIN', async ({ page }) => {
		writeFileSync(HEARTH_FILE, `${HEARTH_FIXTURE}edit_lock: pin\nedit_pin: '2468'\n`);
		await open(page);
		await page.getByRole('button', { name: 'Edit Hearth configuration' }).click();
		const prompt = page.getByRole('dialog', { name: 'Enter the edit PIN' });
		await prompt.getByLabel('Edit PIN').fill('1111');
		await prompt.getByRole('button', { name: 'Unlock' }).click();
		await expect(prompt.getByRole('alert')).toHaveText('Wrong PIN');
		await prompt.getByLabel('Edit PIN').fill('2468');
		await prompt.getByRole('button', { name: 'Unlock' }).click();
		await expect(prompt).toBeHidden();
		await expect(editBarSave(page)).toBeVisible();
	});
});
