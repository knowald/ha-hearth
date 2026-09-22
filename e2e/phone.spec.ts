import { expect, test } from '@playwright/test';

/* The phone layout: pages stay reachable without scrolling, sheets fit. */

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();
});

test('the page strip sits at the top and switches pages without scrolling', async ({ page }) => {
	const strip = page.getByRole('navigation', { name: 'Pages' });
	await expect(strip).toBeInViewport();
	await expect(strip.getByRole('button', { name: /Office/ })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await expect(page.getByRole('button', { name: 'Edit Hearth configuration' })).toBeInViewport();
	const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
	expect(overflow).toBe(0);
});

test('the window reaches under the device cutouts', async ({ page }) => {
	// without viewport-fit=cover every env(safe-area-inset-*) in the stylesheets
	// resolves to zero, whatever the device
	await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
		'content',
		/viewport-fit=cover/
	);
});

test('the glance widgets ride above the page and the rest follow it', async ({ page }) => {
	const runs = page.locator('.rail-run');
	await expect(runs).toHaveCount(2);

	const clock = runs.first().locator('.widget').first();
	await expect(clock).toBeVisible();
	const clockBox = (await clock.boundingBox())!;
	const pageBox = (await page.locator('.main').boundingBox())!;
	expect(clockBox.y).toBeLessThan(pageBox.y);

	// the strip carries the pages, so the rail's own copy would be redundant
	await expect(page.locator('.rail-run .widget.in-switcher')).toHaveCount(1);
	await expect(
		page.getByRole('navigation', { name: 'Pages' }).getByRole('button', { name: 'Office' })
	).toBeVisible();
});

/* short enough that the first page has somewhere to scroll to */
test.describe('switching pages', () => {
	test.use({ viewport: { width: 390, height: 500 } });

	test('a page opens at its own top, not the previous page scroll offset', async ({ page }) => {
		// the fixture has one page; the second one is the point of the test
		await page.getByRole('button', { name: 'Edit Hearth configuration' }).click();
		await page.getByRole('button', { name: 'Add page' }).first().click();
		const sheet = page.getByRole('dialog', { name: 'Add page' });
		await sheet.getByLabel('Name').fill('Garage');
		await sheet.getByRole('button', { name: 'Done' }).click();

		const strip = page.getByRole('navigation', { name: 'Pages' });
		const office = strip.getByRole('button', { name: 'Office' });
		await office.click();

		const scrollTop = () =>
			page.evaluate(() => (document.querySelector('.layout') as HTMLElement).scrollTop);
		await page.evaluate(() => {
			const layout = document.querySelector('.layout') as HTMLElement;
			layout.scrollTop = layout.scrollHeight;
		});
		expect(await scrollTop()).toBeGreaterThan(0);

		const garage = strip.getByRole('button', { name: 'Garage' });
		await garage.click();
		await expect(garage).toHaveAttribute('aria-current', 'page');
		expect(await scrollTop()).toBe(0);
	});
});

test('nothing scrolls under the page strip', async ({ page }) => {
	await page.evaluate(() => {
		(document.querySelector('.layout') as HTMLElement).scrollTop = 400;
	});
	const strip = page.getByRole('navigation', { name: 'Pages' });
	const box = (await strip.boundingBox())!;
	expect(Math.round(box.y)).toBe(0);
	// opaque, so the page passing behind it cannot show through the pills
	await expect(strip).toHaveCSS('background-image', 'none');
});

test.describe('held sideways', () => {
	test.use({ viewport: { width: 844, height: 390 } });

	test('the page starts at the strip and the pills shed their labels', async ({ page }) => {
		// no height to spend before the page, so nothing rides above it
		await expect(page.locator('.rail-run')).toHaveCount(1);
		const main = (await page.locator('.main').boundingBox())!;
		expect(main.y).toBeLessThan(120);

		const strip = page.getByRole('navigation', { name: 'Pages' });
		const office = strip.getByRole('button', { name: 'Office' });
		// the label goes to assistive technology rather than being dropped
		await expect(office).toHaveAttribute('aria-current', 'page');
		await expect(office).toBeVisible();
	});
});

test('a light popup opens as a bottom sheet and the card sheet leads with its fields', async ({
	page
}) => {
	const tile = page.getByRole('button', { name: /Desk lamp/ });
	const box = (await tile.boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.waitForTimeout(700);
	await page.mouse.up();
	const toggle = page.getByRole('switch', { name: 'Toggle light' });
	await expect(toggle).toBeVisible();
	const sheetBox = (await page.locator('.sheet').first().boundingBox())!;
	expect(Math.round(sheetBox.x + sheetBox.width)).toBe(390);
	expect(Math.round(sheetBox.y + sheetBox.height)).toBe(844);
	await page.keyboard.press('Escape');

	await page.getByRole('button', { name: 'Edit Hearth configuration' }).click();
	await page
		.locator('.card-slot', { hasText: 'Lights' })
		.getByRole('button', { name: 'Edit' })
		.click();
	const sheet = page.getByRole('dialog', { name: 'Edit card' });
	await expect(sheet).toBeVisible();
	const title = await sheet.getByLabel('Title').boundingBox();
	const preview = await sheet.locator('.pane').boundingBox();
	expect(title!.y).toBeLessThan(preview!.y);
});
