import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/*
 * Unsaved work survives the accidental ways out: a backdrop tap, a reload, a
 * refresh pushed from Home Assistant, the sleep screen, and a stale page.
 */

const FAKE_HASS = `http://127.0.0.1:${process.env.E2E_HASS_PORT ?? 8124}`;
const HEARTH_FILE = new URL('./fixture/data/hearth.yaml', import.meta.url);
const HEARTH_FIXTURE = readFileSync(HEARTH_FILE, 'utf8');

async function open(page: Page) {
	await page.goto('/');
	await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();
}

async function startEditing(page: Page) {
	await page.getByRole('button', { name: 'Edit Hearth configuration' }).click();
	await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
}

test.beforeEach(async ({ request }) => {
	await request.post(`${FAKE_HASS}/_test/reset`);
});

test.afterEach(() => writeFileSync(HEARTH_FILE, HEARTH_FIXTURE));

test('a backdrop tap asks before dropping a filled-in form', async ({ page }) => {
	await open(page);
	await startEditing(page);
	await page.getByRole('button', { name: 'Add page' }).first().click();
	const sheet = page.getByRole('dialog', { name: 'Add page' });
	await sheet.getByLabel('Name').fill('Garage');

	// the left edge of the viewport is backdrop, clear of the centered sheet
	await page.mouse.click(12, 400);
	const confirm = page.getByRole('alertdialog');
	await expect(confirm).toContainText('Discard changes?');
	await confirm.getByRole('button', { name: 'Cancel' }).click();
	await expect(sheet).toBeVisible();
	await expect(sheet.getByLabel('Name')).toHaveValue('Garage');

	await page.mouse.click(12, 400);
	await confirm.getByRole('button', { name: 'Discard' }).click();
	await expect(sheet).toBeHidden();
	await expect(page.getByRole('button', { name: /Garage/ })).toHaveCount(0);
});

test('Escape closes an untouched form without asking', async ({ page }) => {
	await open(page);
	await startEditing(page);
	await page.getByRole('button', { name: 'Add page' }).first().click();
	const sheet = page.getByRole('dialog', { name: 'Add page' });
	await expect(sheet).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
	await expect(page.getByRole('alertdialog')).toHaveCount(0);
});

test('the browser asks before a reload drops unsaved edits', async ({ page }) => {
	await open(page);
	await startEditing(page);
	await page.getByRole('button', { name: 'Add page' }).first().click();
	const sheet = page.getByRole('dialog', { name: 'Add page' });
	await sheet.getByLabel('Name').fill('Garage');
	await sheet.getByRole('button', { name: 'Done' }).click();
	// the closed sheet's history.back() would abort the reload (see ui/layers.ts)
	await page.waitForFunction(() => !history.state?.hearthLayer);

	const dialogs: string[] = [];
	page.on('dialog', (dialog) => {
		dialogs.push(dialog.type());
		void dialog.accept();
	});
	await page.reload();
	expect(dialogs).toEqual(['beforeunload']);
	await expect(page.getByRole('button', { name: 'Edit Hearth configuration' })).toBeVisible();
});

test('the browser also asks while a sheet holds typed changes', async ({ page }) => {
	await open(page);
	await startEditing(page);
	await page.getByRole('button', { name: 'Add page' }).first().click();
	await page.getByRole('dialog', { name: 'Add page' }).getByLabel('Name').fill('Garage');

	const dialogs: string[] = [];
	page.on('dialog', (dialog) => {
		dialogs.push(dialog.type());
		void dialog.accept();
	});
	await page.reload();
	expect(dialogs).toEqual(['beforeunload']);
});

test('a refresh from Home Assistant waits for the edit session to end', async ({
	page,
	request
}) => {
	let refreshArrived = false;
	page.on('websocket', (socket) =>
		socket.on('framereceived', (frame) => {
			if (String(frame.payload).includes('"refresh"')) refreshArrived = true;
		})
	);
	await open(page);
	await startEditing(page);
	await page.evaluate(() => ((window as unknown as { marker: boolean }).marker = true));
	await request.post(`${FAKE_HASS}/_test/fire_event`, { data: { event: 'refresh' } });
	await expect.poll(() => refreshArrived).toBe(true);
	// a reload started by the event would destroy this context and fail the evaluate
	expect(
		await page.evaluate(async () => {
			await new Promise((resolve) => setTimeout(resolve, 50));
			return (window as unknown as { marker?: boolean }).marker;
		})
	).toBe(true);
	await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();

	await page.getByRole('button', { name: 'Cancel', exact: true }).click();
	await expect
		.poll(() => page.evaluate(() => (window as unknown as { marker?: boolean }).marker))
		.toBeUndefined();
});

test('the sleep screen stays away while editing', async ({ page }) => {
	writeFileSync(HEARTH_FILE, `${HEARTH_FIXTURE}screensaver_minutes: 1\n`);
	await page.clock.install();
	await open(page);
	await startEditing(page);
	await page.clock.fastForward('03:00');
	// the idle timer has fired by now; one round trip lets the page render what it set
	await page.evaluate(() => new Promise((resolve) => queueMicrotask(() => resolve(null))));
	const screensaver = page.getByRole('button', { name: 'Dismiss sleep screen' });
	await expect(screensaver).toHaveCount(0);

	await page.getByRole('button', { name: 'Cancel', exact: true }).click();
	await page.clock.fastForward('01:05');
	await expect(screensaver).toBeVisible();
});

test('offers a reload before editing a configuration saved elsewhere', async ({ page }) => {
	await open(page);
	writeFileSync(HEARTH_FILE, HEARTH_FIXTURE.replace('revision: 1', 'revision: 9'));
	await page.getByRole('button', { name: 'Edit Hearth configuration' }).click();
	const confirm = page.getByRole('alertdialog');
	await expect(confirm).toContainText('Newer configuration saved');
	await confirm.getByRole('button', { name: 'Edit anyway' }).click();
	await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
});

test('Reload in the newer-configuration prompt reloads the page every time', async ({ page }) => {
	await open(page);
	writeFileSync(HEARTH_FILE, HEARTH_FIXTURE.replace('revision: 1', 'revision: 9'));
	// the closing prompt takes its history entry back with history.back(),
	// which used to abort the reload and leave this page in place
	for (let attempt = 0; attempt < 3; attempt++) {
		await page.evaluate(() => ((window as unknown as { stale: boolean }).stale = true));
		await page.getByRole('button', { name: 'Edit Hearth configuration' }).click();
		const confirm = page.getByRole('alertdialog');
		await expect(confirm).toContainText('Newer configuration saved');
		await confirm.getByRole('button', { name: 'Reload' }).click();
		await page.waitForFunction(() => !(window as unknown as { stale?: boolean }).stale);
		await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();
		writeFileSync(
			HEARTH_FILE,
			HEARTH_FIXTURE.replace('revision: 1', `revision: ${20 + attempt * 10}`)
		);
	}
});
