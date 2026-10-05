import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/*
 * Seasonal theme schedules, a page with a look of its own and a card that
 * spans both columns of its page.
 */

const HEARTH_FILE = new URL('./fixture/data/hearth.yaml', import.meta.url);
const HEARTH_FIXTURE = readFileSync(HEARTH_FILE, 'utf8');

// the Winter preset's outer background, and the default one
const WINTER_BACKGROUND = '#0c1119';
const DEFAULT_BACKGROUND = '#16110c';

function writeFixture() {
	writeFileSync(
		HEARTH_FILE,
		`version: 5
revision: 1
theme_schedule:
  - theme: winter
    from: '12-01'
    to: '02-29'
rail:
  - id: clock
    type: clock
  - id: nav
    type: nav
rooms:
  - id: office
    name: Office
    icon: desk
    columns: 2
    cards:
      - - id: lights
          type: entities
          title: Lights
          entities:
            - entity: light.desk
        - id: wide
          type: entities
          title: Wide
          span: full
          entities:
            - entity: light.shelf
        - id: below
          type: entities
          title: Below
          entities:
            - entity: switch.fan
      - - id: readings
          type: entities
          title: Readings
          style: stat
          entities:
            - entity: sensor.temperature
  - id: garden
    name: Garden
    icon: park
    background_image: /hearth.svg
    background_scrim: strong
    cards:
      - []
`
	);
}

test.beforeEach(() => writeFixture());
test.afterEach(() => writeFileSync(HEARTH_FILE, HEARTH_FIXTURE));

function rootToken(page: Page, name: string) {
	return page.evaluate(
		(token) => getComputedStyle(document.documentElement).getPropertyValue(token).trim(),
		name
	);
}

async function open(page: Page) {
	await page.goto('/');
	await expect(page.locator('[data-page="office"]')).toBeVisible();
}

test('the schedule wears the winter preset from its first day', async ({ page }) => {
	await page.clock.setFixedTime(new Date('2026-11-30T23:59:00'));
	await open(page);
	await expect.poll(() => rootToken(page, '--h-bg-1')).toBe(DEFAULT_BACKGROUND);

	// the shared minute clock picks up the new day
	await page.clock.setFixedTime(new Date('2026-12-01T00:00:00'));
	await expect.poll(() => rootToken(page, '--h-bg-1')).toBe(WINTER_BACKGROUND);
});

test('the schedule runs across the new year', async ({ page }) => {
	await page.clock.setFixedTime(new Date('2027-01-15T12:00:00'));
	await open(page);
	await expect.poll(() => rootToken(page, '--h-bg-1')).toBe(WINTER_BACKGROUND);
});

test('a page background shows only while that page is open', async ({ page }) => {
	await open(page);
	await expect.poll(() => rootToken(page, '--h-bg-image')).toBe('none');

	await page
		.locator('.room-list')
		.getByRole('button', { name: /Garden/ })
		.click();
	await expect(page.locator('[data-page="garden"]')).toBeVisible();
	await expect.poll(() => rootToken(page, '--h-bg-image')).toContain('/hearth.svg');
	await expect.poll(() => rootToken(page, '--h-bg-scrim')).toContain('linear-gradient');

	await page
		.locator('.room-list')
		.getByRole('button', { name: /Office/ })
		.click();
	await expect(page.locator('[data-page="office"]')).toBeVisible();
	await expect.poll(() => rootToken(page, '--h-bg-image')).toBe('none');
	await expect.poll(() => rootToken(page, '--h-bg-scrim')).toBe('none');
});

async function widths(page: Page) {
	const box = async (selector: string) => (await page.locator(selector).boundingBox())!;
	return {
		overview: (await box('[data-page="office"] .overview')).width,
		lights: (await box('.card-slot[data-id="lights"]')).width,
		wide: (await box('.card-slot[data-id="wide"]')).width,
		wideTop: (await box('.card-slot[data-id="wide"]')).y,
		readingsBottom: await box('.card-slot[data-id="readings"]').then((b) => b.y + b.height),
		belowTop: (await box('.card-slot[data-id="below"]')).y
	};
}

test('a full-width card covers both columns and the columns resume below it', async ({ page }) => {
	await open(page);
	const measured = await widths(page);
	expect(Math.abs(measured.wide - measured.overview)).toBeLessThan(2);
	expect(measured.lights).toBeLessThan(measured.overview * 0.6);
	expect(measured.wideTop).toBeGreaterThanOrEqual(measured.readingsBottom);
	expect(measured.belowTop).toBeGreaterThan(measured.wideTop);
});

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

	test('a full-width card is one card in its column like the others', async ({ page }) => {
		await open(page);
		const measured = await widths(page);
		expect(Math.abs(measured.wide - measured.lights)).toBeLessThan(2);
		// stored order: lights, wide, below, then the second column
		expect(measured.belowTop).toBeGreaterThan(measured.wideTop);
		expect(measured.readingsBottom).toBeGreaterThan(measured.belowTop);
	});
});
