import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';

/* The interface scale zooms the root; the frame and the sheets must still fit the screen. */

const HEARTH_FILE = new URL('./fixture/data/hearth.yaml', import.meta.url);
const HEARTH_FIXTURE = readFileSync(HEARTH_FILE, 'utf8');

test.beforeEach(() =>
	writeFileSync(HEARTH_FILE, `${HEARTH_FIXTURE}scale: 150\nmobile_scale: 80\n`)
);
test.afterEach(() => writeFileSync(HEARTH_FILE, HEARTH_FIXTURE));

async function expectFrameFillsViewport(page: Page, zoom: number) {
	await page.goto('/');
	await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();
	const viewport = page.viewportSize()!;
	const layout = await page.evaluate(() => {
		const rect = document.querySelector('.frame')!.getBoundingClientRect();
		return {
			zoom: document.documentElement.currentCSSZoom,
			rect: [rect.left, rect.top, rect.width, rect.height].map(Math.round),
			overflowX: document.documentElement.scrollWidth - innerWidth,
			overflowY: document.documentElement.scrollHeight - innerHeight
		};
	});
	expect(layout.zoom).toBeCloseTo(zoom, 5);
	expect(layout.rect).toEqual([0, 0, viewport.width, viewport.height]);
	expect(layout.overflowX).toBeLessThanOrEqual(0);
	expect(layout.overflowY).toBeLessThanOrEqual(0);
}

async function expectInsideViewport(page: Page, element: Locator) {
	const viewport = page.viewportSize()!;
	const box = (await element.boundingBox())!;
	expect(box.x).toBeGreaterThanOrEqual(0);
	expect(box.y).toBeGreaterThanOrEqual(0);
	expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
	expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
}

async function openSettings(page: Page) {
	await page.getByRole('button', { name: 'Edit Hearth configuration' }).click();
	await page.getByRole('button', { name: 'Settings', exact: true }).click();
	const sheet = page.getByRole('dialog', { name: 'Settings' });
	await expect(sheet).toBeVisible();
	return sheet;
}

test.describe('tablet', () => {
	test.use({ viewport: { width: 1280, height: 800 } });

	test('the frame matches the viewport at 150%', async ({ page }) => {
		await expectFrameFillsViewport(page, 1.5);
	});

	test('the settings sheet fits and shows the stored scale', async ({ page }) => {
		await page.goto('/');
		const sheet = await openSettings(page);
		await expectInsideViewport(page, sheet);
		await expect(
			sheet.getByRole('spinbutton', { name: 'Interface scale', exact: true })
		).toHaveValue('150');
		await expect(sheet.getByRole('spinbutton', { name: 'Mobile interface scale' })).toHaveValue(
			'80'
		);
	});
});

test.describe('phone', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

	test('the frame matches the viewport at the mobile 80%', async ({ page }) => {
		await expectFrameFillsViewport(page, 0.8);
	});

	test('the settings sheet fits the screen', async ({ page }) => {
		await page.goto('/');
		const sheet = await openSettings(page);
		await expectInsideViewport(page, sheet);
	});

	test('edit controls stay finger-sized on screen at 80%', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('button', { name: 'Edit Hearth configuration' }).click();
		const pencil = page.getByRole('button', { name: 'Edit Lights', exact: true });
		// the hit area in screen pixels: its CSS size times the root zoom
		const pencilArea = await pencil.evaluate((element) => {
			const style = getComputedStyle(element, '::before');
			const zoom = element.currentCSSZoom;
			return [parseFloat(style.width) * zoom, parseFloat(style.height) * zoom];
		});
		expect(Math.min(...pencilArea)).toBeGreaterThanOrEqual(43.9);

		await pencil.click();
		const sheet = page.getByRole('dialog', { name: 'Edit card' });
		const close = (await sheet.getByRole('button', { name: 'Close', exact: true }).boundingBox())!;
		expect(Math.min(close.width, close.height)).toBeGreaterThanOrEqual(43.9);
		const done = (await sheet.getByRole('button', { name: 'Done' }).boundingBox())!;
		expect(done.height).toBeGreaterThanOrEqual(43.9);
	});
});
