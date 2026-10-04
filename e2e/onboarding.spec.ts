import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/* Favorites on a phone and the cards an empty page suggests. */

const HEARTH_FILE = new URL('./fixture/data/hearth.yaml', import.meta.url);
const HEARTH_FIXTURE = readFileSync(HEARTH_FILE, 'utf8');

test.afterEach(() => writeFileSync(HEARTH_FILE, HEARTH_FIXTURE));

async function open(page: Page) {
	await page.goto('/');
	await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();
}

/* a held touch, which opens a tile's popup on a phone */
async function hold(page: Page, name: RegExp) {
	const box = (await page.getByRole('button', { name }).boundingBox())!;
	const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
	const session = await page.context().newCDPSession(page);
	await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
	await page.waitForTimeout(700);
	await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	await session.detach();
}

test.describe('favorites on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

	test('a starred entity gets a favorites page ahead of the others', async ({ page }) => {
		await open(page);
		const strip = page.getByRole('navigation', { name: 'Pages' });
		await expect(strip.getByRole('button', { name: 'Favorites' })).toHaveCount(0);

		await hold(page, /Shelf lamp/);
		const star = page.getByRole('button', { name: 'Favorite', exact: true });
		await star.click();
		await expect(star).toHaveAttribute('aria-pressed', 'true');
		await page.keyboard.press('Escape');

		const pill = strip.getByRole('button', { name: 'Favorites' });
		await expect(pill).toBeVisible();
		const pills = await strip.getByRole('button').allInnerTexts();
		expect(pills[0]).toContain('Favorites');
		await pill.click();
		await expect(pill).toHaveAttribute('aria-current', 'page');
		await expect(page.locator('.main').getByRole('button', { name: /Shelf lamp/ })).toBeVisible();
		await expect(page.locator('.main').getByRole('button', { name: /Desk lamp/ })).toHaveCount(0);

		// kept in this browser, not in hearth.yaml
		await page.reload();
		await expect(strip.getByRole('button', { name: 'Favorites' })).toBeVisible();
		expect(readFileSync(HEARTH_FILE, 'utf8')).toBe(HEARTH_FIXTURE);

		await page.getByRole('button', { name: 'This screen' }).click();
		await page.getByRole('switch', { name: 'Show favorites page' }).click();
		await page.getByRole('button', { name: 'Close', exact: true }).first().click();
		await expect(strip.getByRole('button', { name: 'Favorites' })).toHaveCount(0);
	});
});

test.describe('an empty page', () => {
	test.beforeEach(() => {
		writeFileSync(
			HEARTH_FILE,
			HEARTH_FIXTURE.replace(
				'rooms:\n',
				'rooms:\n  - id: living-room\n    name: Living room\n    icon: weekend\n    cards: []\n'
			)
		);
	});

	test('suggests the cards of its area and adds one per tap', async ({ page }) => {
		await page.goto('/?room=living-room');
		const suggestions = page.getByRole('region', { name: 'Suggested cards' });
		await expect(suggestions.getByText('Suggested for Living room')).toBeVisible();

		await suggestions.getByRole('button', { name: 'Add Lighting' }).click();
		await expect(page.locator('.card-slot', { hasText: 'Lighting' })).toBeVisible();
		await expect(page.getByRole('button', { name: /LED strip/ })).toBeVisible();
		await expect(suggestions.getByRole('button', { name: 'Add Lighting' })).toHaveCount(0);
		// outside edit mode the card is saved at once
		await expect.poll(() => readFileSync(HEARTH_FILE, 'utf8')).toContain('living-room-lighting');
	});
});
