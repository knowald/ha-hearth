import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

/* The chart card against the statistics fake-hass.mjs synthesizes. */

const FAKE_HASS = `http://127.0.0.1:${process.env.E2E_HASS_PORT ?? 8124}`;
const HEARTH_FILE = new URL('./fixture/data/hearth.yaml', import.meta.url);
const HEARTH_FIXTURE = readFileSync(HEARTH_FILE, 'utf8');

const WITH_CHARTS = `version: 5
revision: 1
swipe_navigation_mobile: true
rail:
  - id: nav
    type: nav
rooms:
  - id: home
    name: Home
    icon: home
    columns: 1
    cards:
      - - id: climate-chart
          type: chart
          name: Climate
          entities:
            - entity: sensor.temperature
            - entity: sensor.humidity
              color: good
        - id: energy-chart
          type: chart
          style: bar
          period: week
          entities:
            - entity: sensor.energy
  - id: garage
    name: Garage
    icon: garage
    cards: []
`;

function setState(request: APIRequestContext, entity_id: string, state: string) {
	return request.post(`${FAKE_HASS}/_test/state`, { data: { entity_id, state } });
}

async function touchDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
	const session = await page.context().newCDPSession(page);
	await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
	const steps = 12;
	for (let step = 1; step <= steps; step += 1) {
		const x = from.x + ((to.x - from.x) * step) / steps;
		const y = from.y + ((to.y - from.y) * step) / steps;
		await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
	}
	await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	await session.detach();
}

const climate = (page: Page) => page.locator('[data-card-type="chart"]').first();
const energy = (page: Page) => page.locator('[data-card-type="chart"]').nth(1);

test.beforeEach(async ({ request }) => {
	writeFileSync(HEARTH_FILE, WITH_CHARTS);
	await request.post(`${FAKE_HASS}/_test/reset`);
});

test.afterEach(() => writeFileSync(HEARTH_FILE, HEARTH_FIXTURE));

test('draws a line per entity and opens an entity from its chip', async ({ page }) => {
	await page.goto('/');
	const card = climate(page);
	await expect(card.locator('path.line')).toHaveCount(2);
	await expect(card.locator('.y-axis span').first()).toBeVisible();
	await expect(card.locator('.x-axis span')).toHaveCount(3);
	const humidity = card.getByRole('button', { name: /Humidity/ });
	await expect(humidity).toContainText('47%');
	await expect(humidity.locator('.dot')).toHaveAttribute('style', /--h-good/);
	await humidity.click();
	await expect(page.getByRole('dialog', { name: 'Humidity' })).toBeVisible();
});

test('a tap on the plot reads every entity at that time, the keys step through it', async ({
	page
}) => {
	await page.goto('/');
	const plot = climate(page).getByRole('slider', { name: 'Climate' });
	await expect(climate(page).locator('path.line')).toHaveCount(2);
	const box = (await plot.boundingBox())!;
	await page.mouse.click(box.x + 2, box.y + box.height / 2);
	await expect(plot).toHaveAttribute('aria-valuenow', '0');
	const readout = climate(page).locator('.readout');
	await expect(readout).not.toHaveClass(/idle/);
	await expect(readout).toContainText('Temperature');
	await expect(readout).toContainText('Humidity');
	await expect(climate(page).locator('circle.marker')).toHaveCount(2);

	await page.keyboard.press('ArrowRight');
	await expect(plot).toHaveAttribute('aria-valuenow', '1');
	await expect(plot).toHaveAttribute('aria-valuetext', /Temperature .+, Humidity .+%$/);
	await page.keyboard.press('Escape');
	await expect(readout).toHaveClass(/idle/);
});

test('draws the week as daily bars with the running day dashed', async ({ page }) => {
	await page.goto('/');
	const card = energy(page);
	await expect(card.locator('.period')).toHaveText('Last week');
	await expect(card.locator('rect.bar').first()).toBeVisible();
	expect(await card.locator('rect.bar').count()).toBeGreaterThanOrEqual(7);
	await expect(card.locator('rect.bar.current')).toHaveCount(1);
	await expect(card.locator('.grid.zero')).toHaveCount(1);
});

test('an unavailable entity shows its state in its chip and keeps its history', async ({
	page,
	request
}) => {
	await page.goto('/');
	await expect(climate(page).locator('path.line')).toHaveCount(2);
	await setState(request, 'sensor.humidity', 'unavailable');
	await expect(climate(page).locator('.chip', { hasText: 'Humidity' })).toContainText(
		'Unavailable'
	);
	await expect(climate(page).locator('path.line')).toHaveCount(2);
});

test('an entity added in the editor is drawn and saved', async ({ page }) => {
	await page.goto('/');
	await expect(climate(page).locator('path.line')).toHaveCount(2);
	await page.getByRole('button', { name: 'Edit Hearth configuration' }).click();
	await page
		.locator('.card-slot', { hasText: 'Climate' })
		.getByRole('button', { name: 'Edit' })
		.click();
	const sheet = page.getByRole('dialog', { name: 'Edit card' });
	await expect(sheet.locator('.preview path.line')).toHaveCount(2);

	await sheet.getByRole('button', { name: 'Add entity' }).click();
	const row = sheet.getByRole('group', { name: 'Entity 3' });
	await row.getByLabel('Entity', { exact: true }).fill('sensor.power');
	await row.getByRole('group', { name: 'Color' }).getByRole('button', { name: 'Bad' }).click();
	await sheet.getByLabel('Style').selectOption('bar');
	await expect(sheet.locator('.preview .chip', { hasText: 'Power' })).toBeVisible();
	await expect(sheet.locator('.preview rect.bar').first()).toBeVisible();

	await sheet.getByRole('button', { name: 'Done' }).click();
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect
		.poll(() => readFileSync(HEARTH_FILE, 'utf8'))
		.toMatch(/- entity: sensor.power\s+color: bad\s+style: bar/);

	await page.reload();
	await expect(climate(page).locator('.chip')).toHaveCount(3);
	await expect(climate(page).locator('rect.bar').first()).toBeVisible();
});

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 700 }, hasTouch: true, isMobile: true });

	test('a sideways swipe across the plot changes the page and selects nothing', async ({
		page
	}) => {
		await page.goto('/');
		const plot = climate(page).getByRole('slider');
		await expect(climate(page).locator('path.line')).toHaveCount(2);
		const box = (await plot.boundingBox())!;
		const y = box.y + box.height / 2;
		await touchDrag(page, { x: box.x + box.width - 20, y }, { x: box.x + 20, y });
		await expect(
			page.getByRole('navigation', { name: 'Pages' }).getByRole('button', { name: 'Garage' })
		).toHaveAttribute('aria-current', 'page');
	});

	test('a tap on the plot selects a time', async ({ page }) => {
		await page.goto('/');
		const plot = climate(page).getByRole('slider');
		await expect(climate(page).locator('path.line')).toHaveCount(2);
		await plot.tap();
		await expect(climate(page).locator('.readout')).not.toHaveClass(/idle/);
	});
});
