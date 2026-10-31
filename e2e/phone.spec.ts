import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/* The phone layout: pages stay in thumb reach, the header is one row, sheets fit. */

const HEARTH_FILE = new URL('./fixture/data/hearth.yaml', import.meta.url);
const HEARTH_FIXTURE = readFileSync(HEARTH_FILE, 'utf8');

/*
 * A second page and a four-column card, which the shared fixture lacks. A
 * document of its own rather than an edit of the shared one: other specs
 * save into that file.
 */
function writeFixture() {
	writeFileSync(
		HEARTH_FILE,
		`version: 5
revision: 1
rail:
  - id: clock
    type: clock
    hour_format: '24'
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
          columns: 4
          entities:
            - entity: light.desk
            - entity: light.shelf
            - entity: switch.fan
            - entity: switch.heater
  - id: kitchen
    name: Kitchen
    icon: kitchen
    cards: []
`
	);
}

async function open(page: Page) {
	await page.goto('/');
	await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();
}

const bar = (page: Page) => page.getByRole('navigation', { name: 'Pages' });

/* the edit entry sits in the bottom bar's More menu on a phone */
async function startEditing(page: Page) {
	await bar(page).getByRole('button', { name: 'More' }).click();
	await page.getByRole('button', { name: 'Edit dashboard' }).click();
	await expect(page.locator('.edit-bar')).toBeVisible();
}

/*
 * The layout clips sideways overflow (overflow-x: hidden), so the document
 * never grows wider than the window whatever spills. The scrollers' own
 * scroll widths and the content boxes are what show it.
 */
async function sidewaysOverflow(page: Page) {
	return page.evaluate(() => {
		const scrollers = [...document.querySelectorAll<HTMLElement>('.layout, .main')];
		const cut = Math.max(...scrollers.map((element) => element.scrollWidth - element.clientWidth));
		const past = [...document.querySelectorAll('.card-slot, .entity-slot, .rail-run .widget')]
			.map((element) => element.getBoundingClientRect())
			.filter((box) => box.width > 0 && (box.left < -0.5 || box.right > innerWidth + 0.5));
		return { cut, past: past.length };
	});
}

/** The x positions of the Lights card's tiles, one per track in use. */
async function lightsTracks(page: Page) {
	const boxes = await page
		.locator('.card-slot', { hasText: 'Lights' })
		.locator('.entity-slot')
		.evaluateAll((slots) => slots.map((slot) => slot.getBoundingClientRect().x));
	return new Set(boxes.map(Math.round)).size;
}

/* a finger drag in small steps, as real touch input with its pointer events */
async function touchDrag(page: Page, start: Point, end: Point) {
	const session = await page.context().newCDPSession(page);
	await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
	const steps = 12;
	for (let step = 1; step <= steps; step += 1) {
		await session.send('Input.dispatchTouchEvent', {
			type: 'touchMove',
			touchPoints: [
				{
					x: start.x + ((end.x - start.x) * step) / steps,
					y: start.y + ((end.y - start.y) * step) / steps
				}
			]
		});
	}
	await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	await session.detach();
}

type Point = { x: number; y: number };

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test.afterEach(() => writeFileSync(HEARTH_FILE, HEARTH_FIXTURE));

test.describe('the shared fixture', () => {
	test.beforeEach(async ({ page }) => open(page));

	test('the bottom bar holds the pages, search and More within thumb reach', async ({ page }) => {
		const strip = bar(page);
		await expect(strip).toBeInViewport();
		const box = (await strip.boundingBox())!;
		expect(box.y + box.height).toBeGreaterThan(844 - 40);
		expect(box.y + box.height).toBeLessThanOrEqual(844);
		await expect(strip.getByRole('button', { name: /Office/ })).toHaveAttribute(
			'aria-current',
			'page'
		);
		// the floating edit and screen buttons moved into the bar's More menu
		await expect(page.getByRole('button', { name: 'Edit Hearth configuration' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'This screen' })).toHaveCount(0);
		await strip.getByRole('button', { name: 'More' }).click();
		await expect(page.getByRole('button', { name: 'Edit dashboard' })).toBeInViewport();
		await page.getByRole('button', { name: 'Screen settings' }).click();
		await expect(page.getByRole('dialog', { name: 'This screen' })).toBeVisible();
		await page.keyboard.press('Escape');
		expect(await sidewaysOverflow(page)).toEqual({ cut: 0, past: 0 });
	});

	test('edit mode trades the bottom bar for its own and the page strip at the top', async ({
		page
	}) => {
		await startEditing(page);
		await expect(page.locator('.phone-bar')).toHaveCount(0);
		const strip = page.locator('.phone-nav');
		await expect(strip.getByRole('button', { name: 'Office' })).toBeInViewport();
		await expect(strip.getByRole('button', { name: 'Add page' })).toBeVisible();
		expect((await strip.boundingBox())!.y).toBeLessThan(20);

		await page.locator('.edit-bar').getByRole('button', { name: 'Cancel' }).click();
		await expect(bar(page)).toBeInViewport();
		await expect(page.locator('.phone-nav')).toHaveCount(0);
	});

	test('the window reaches under the device cutouts', async ({ page }) => {
		// without viewport-fit=cover every env(safe-area-inset-*) in the stylesheets
		// resolves to zero, whatever the device
		await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
			'content',
			/viewport-fit=cover/
		);
	});

	test('a one-row header stands in for the clock widget above the page', async ({ page }) => {
		// nothing else rides above the page, so only the run below it is drawn
		await expect(page.locator('.rail-run')).toHaveCount(1);
		await expect(page.locator('.rail-run [data-id="clock"]')).toHaveCount(0);

		const header = page.locator('.phone-header');
		await expect(header.locator('time')).toHaveText(/\d{1,2}:\d{2}/);
		const headerBox = (await header.boundingBox())!;
		const pageBox = (await page.locator('.main').boundingBox())!;
		expect(headerBox.y + headerBox.height).toBeLessThanOrEqual(pageBox.y);
		expect(headerBox.height).toBeLessThanOrEqual(48);

		// the bar carries the pages, so the rail's own copy would be redundant
		await expect(page.locator('.rail-run .widget.in-switcher')).toHaveCount(1);
		await expect(bar(page).getByRole('button', { name: 'Office' })).toBeVisible();

		// the editor still shows the clock, dimmed, where it would go
		await startEditing(page);
		await expect(page.locator('.rail-run').first().locator('[data-id="clock"]')).toHaveClass(
			/visibility-dimmed/
		);
	});

	test('the bottom bar stays put while the page scrolls under it', async ({ page }) => {
		const before = (await bar(page).boundingBox())!;
		await page.evaluate(() => {
			(document.querySelector('.layout') as HTMLElement).scrollTop = 400;
		});
		const after = (await bar(page).boundingBox())!;
		expect(after.y).toBe(before.y);
		// opaque, so the page passing behind it cannot show through the tabs
		await expect(bar(page)).toHaveCSS('background-image', /gradient/);
	});

	test('a light popup opens as a bottom sheet and the card sheet leads with its fields', async ({
		page
	}) => {
		const tile = page.getByRole('button', { name: /Desk lamp/ });
		const box = (await tile.boundingBox())!;
		const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
		const session = await page.context().newCDPSession(page);
		await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
		await page.waitForTimeout(700);
		await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
		await session.detach();
		const toggle = page.getByRole('switch', { name: 'Toggle light' });
		await expect(toggle).toBeVisible();
		const sheetBox = (await page.locator('.sheet').first().boundingBox())!;
		expect(Math.round(sheetBox.x + sheetBox.width)).toBe(390);
		expect(Math.round(sheetBox.y + sheetBox.height)).toBe(844);
		await page.keyboard.press('Escape');

		await startEditing(page);
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

	test('taps show only our own press feedback', async ({ page }) => {
		const touchStyle = (name: RegExp | string) =>
			page
				.getByRole('button', { name })
				.first()
				.evaluate((element) => {
					const style = getComputedStyle(element);
					return {
						highlight: style.getPropertyValue('-webkit-tap-highlight-color'),
						touchAction: style.touchAction,
						userSelect: style.userSelect
					};
				});
		const tile = await touchStyle(/Desk lamp/);
		const button = await touchStyle('More');
		expect(tile.highlight).toBe('rgba(0, 0, 0, 0)');
		expect(button.highlight).toBe('rgba(0, 0, 0, 0)');
		// tiles keep vertical panning and pinch zoom; plain buttons lose the double-tap zoom
		expect(tile.touchAction).toBe('pan-y pinch-zoom');
		expect(button.touchAction).toBe('manipulation');
		expect(button.userSelect).toBe('none');
	});

	test('entity drag handles take a finger-sized touch', async ({ page }) => {
		await startEditing(page);
		const handle = page.locator('.entity-drag-handle').first();
		await expect(handle).toBeVisible();
		const visible = (await handle.boundingBox())!;
		expect(visible.width).toBeLessThan(44);
		const hitArea = await handle.evaluate((element) => {
			const style = getComputedStyle(element, '::before');
			return { width: parseFloat(style.width), height: parseFloat(style.height) };
		});
		expect(hitArea.width).toBeGreaterThanOrEqual(44);
		expect(hitArea.height).toBeGreaterThanOrEqual(44);
	});

	test('edit chips take a finger-sized touch on the grip and the pencil', async ({ page }) => {
		await startEditing(page);
		const card = page.locator('.card-slot', { hasText: 'Lights' });
		const pencil = card.getByRole('button', { name: 'Edit Lights', exact: true });
		await expect(pencil).toBeVisible();
		// a touch on a grip drags; anywhere else it still scrolls the page
		const grip = card.locator('.chip .drag-handle');
		await expect(grip).toHaveCSS('touch-action', 'none');
		await expect(page.locator('.room-list .drag-handle').first()).toHaveCSS('touch-action', 'none');

		for (const part of [grip, pencil]) {
			const visible = (await part.boundingBox())!;
			expect(visible.width).toBeLessThan(44);
			const hitArea = await part.evaluate((element) => {
				const style = getComputedStyle(element, '::before');
				return { width: parseFloat(style.width), height: parseFloat(style.height) };
			});
			expect(hitArea.width).toBeGreaterThanOrEqual(44);
			expect(hitArea.height).toBeGreaterThanOrEqual(44);
		}

		// the two areas meet in the gap instead of one covering the other
		const box = (await pencil.boundingBox())!;
		const hits = await page.evaluate(
			({ x, y }) => ({
				right: document.elementFromPoint(x + 18, y)?.closest('.pencil, .drag-handle')?.className,
				left: document.elementFromPoint(x - 18, y)?.closest('.pencil, .drag-handle')?.className
			}),
			{ x: box.x + box.width / 2, y: box.y + box.height / 2 }
		);
		expect(hits.right).toContain('pencil');
		expect(hits.left).toContain('drag-handle');
	});

	test('a touch drag on an entity handle reorders the tiles', async ({ page }) => {
		await startEditing(page);
		const card = page.locator('.card-slot', { hasText: 'Lights' });
		const slots = card.locator('.entity-slot');
		await expect(slots.first()).toContainText('Desk lamp');

		const from = (await card.locator('.entity-drag-handle').nth(2).boundingBox())!;
		const to = (await slots.first().boundingBox())!;
		await touchDrag(
			page,
			{ x: from.x + from.width / 2, y: from.y + from.height / 2 },
			{ x: from.x + from.width / 2, y: to.y + to.height * 0.25 }
		);

		await expect(slots.first()).toContainText('Ceiling fan');
		await expect(slots.nth(1)).toContainText('Desk lamp');
	});

	test('a touch drag on a card grip moves the card', async ({ page }) => {
		await startEditing(page);
		const cards = page.locator('.column > .card-slot');
		await expect(cards.first()).toHaveAttribute('data-id', 'lights');

		const grip = page.locator('.card-slot[data-id="readings"] .chip .drag-handle');
		const from = (await grip.boundingBox())!;
		const to = (await cards.first().boundingBox())!;
		await touchDrag(
			page,
			{ x: from.x + from.width / 2, y: from.y + from.height / 2 },
			{ x: from.x + from.width / 2, y: to.y + to.height * 0.25 }
		);

		await expect(cards.first()).toHaveAttribute('data-id', 'readings');
	});
});

/* short enough that the first page has somewhere to scroll to */
test.describe('a page taller than the screen', () => {
	test.use({ viewport: { width: 390, height: 500 } });

	test.beforeEach(async ({ page }) => open(page));

	test('a page opens at its own top, not the previous page scroll offset', async ({ page }) => {
		// the fixture has one page; the second one is the point of the test
		await startEditing(page);
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

	test('scrolled to the end, the bottom bar clears the last content', async ({ page }) => {
		await page.evaluate(() => {
			const layout = document.querySelector('.layout') as HTMLElement;
			layout.scrollTop = layout.scrollHeight;
		});
		const toggle = (await bar(page).boundingBox())!;
		const contentBottom = await page.evaluate(() =>
			Math.max(
				...[...document.querySelectorAll('.card-slot, .rail-run .widget')]
					.map((element) => element.getBoundingClientRect())
					.filter((box) => box.height > 0)
					.map((box) => box.bottom)
			)
		);
		expect(contentBottom).toBeLessThanOrEqual(toggle.y);
	});
});

test.describe('the smallest phone', () => {
	test.use({ viewport: { width: 320, height: 568 } });

	test.beforeEach(async ({ page }) => open(page));

	test('nothing spills sideways', async ({ page }) => {
		await expect(page.getByRole('navigation', { name: 'Pages' })).toBeInViewport();
		expect(await sidewaysOverflow(page)).toEqual({ cut: 0, past: 0 });
	});
});

test.describe('a card with its own column count', () => {
	test.beforeEach(async ({ page }) => {
		writeFixture();
		await open(page);
	});

	test('keeps two tracks on a phone and one per row while editing', async ({ page }) => {
		expect(await lightsTracks(page)).toBe(2);
		expect(await sidewaysOverflow(page)).toEqual({ cut: 0, past: 0 });

		await startEditing(page);
		await expect(page.locator('.entity-drag-handle').first()).toBeVisible();
		expect(await lightsTracks(page)).toBe(1);
	});

	test.describe('at 320 wide', () => {
		test.use({ viewport: { width: 320, height: 568 } });

		test('still fits', async ({ page }) => {
			expect(await lightsTracks(page)).toBe(2);
			expect(await sidewaysOverflow(page)).toEqual({ cut: 0, past: 0 });
		});
	});
});

test.describe('held sideways', () => {
	test.use({ viewport: { width: 844, height: 390 } });

	test.beforeEach(async ({ page }) => {
		writeFixture();
		await open(page);
	});

	test('the page starts under the header and the tabs set their labels beside the icon', async ({
		page
	}) => {
		// no height to spend before the page, so nothing rides above it
		await expect(page.locator('.rail-run')).toHaveCount(1);
		const main = (await page.locator('.main').boundingBox())!;
		expect(main.y).toBeLessThan(120);

		const office = bar(page).getByRole('button', { name: 'Office' });
		await expect(office).toHaveAttribute('aria-current', 'page');
		await expect(office.getByText('Office', { exact: true })).toBeVisible();
		expect((await bar(page).boundingBox())!.height).toBeLessThanOrEqual(56);
		const icon = (await office.locator('.mi').boundingBox())!;
		const label = (await office.getByText('Office', { exact: true }).boundingBox())!;
		expect(label.x).toBeGreaterThan(icon.x + icon.width - 1);
		expect(await sidewaysOverflow(page)).toEqual({ cut: 0, past: 0 });
	});
});

test.describe('the phone header', () => {
	test.beforeEach(async ({ page }) => {
		writeFixture();
		await open(page);
	});

	async function expectHeaderFits(page: Page) {
		const header = page.locator('.phone-header');
		// the clock widget's hour format carries over
		await expect(header.locator('time')).toHaveText(/\d{2}:\d{2}/);
		expect((await header.boundingBox())!.height).toBeLessThanOrEqual(48);
		expect(await sidewaysOverflow(page)).toEqual({ cut: 0, past: 0 });
	}

	test('shows the time in one row', async ({ page }) => {
		await expectHeaderFits(page);
	});

	test.describe('at 320 wide', () => {
		test.use({ viewport: { width: 320, height: 568 } });

		test('still fits', async ({ page }) => {
			await expectHeaderFits(page);
		});
	});

	test.describe('held sideways', () => {
		test.use({ viewport: { width: 844, height: 390 } });

		test('still fits', async ({ page }) => {
			await expectHeaderFits(page);
		});
	});
});

test.describe('many pages', () => {
	test.beforeEach(async ({ page }) => {
		const rooms = ['Kitchen', 'Garage', 'Hallway', 'Bedroom', 'Garden', 'Attic']
			.map(
				(name) =>
					`  - id: ${name.toLowerCase()}\n    name: ${name}\n    icon: home\n    cards: []\n`
			)
			.join('');
		writeFileSync(HEARTH_FILE, `${HEARTH_FIXTURE.trimEnd()}\n${rooms}`);
		await page.goto('/?room=attic');
		await expect(bar(page).getByRole('button', { name: 'Attic' })).toBeVisible();
	});

	test('scroll sideways inside the bar while search and More stay put', async ({ page }) => {
		const attic = bar(page).getByRole('button', { name: 'Attic' });
		await expect(attic).toHaveAttribute('aria-current', 'page');
		// a page opened by link is scrolled into the bar
		await expect(attic).toBeInViewport({ ratio: 1 });
		const more = (await bar(page).getByRole('button', { name: 'More' }).boundingBox())!;
		expect(more.x + more.width).toBeLessThanOrEqual(390);
		const scrolls = await page
			.locator('.phone-bar .tabs')
			.evaluate((element) => element.scrollWidth > element.clientWidth);
		expect(scrolls).toBe(true);
		expect(await sidewaysOverflow(page)).toEqual({ cut: 0, past: 0 });
	});
});

/* an iPhone Pro Max on its side is wider than the fold */
test.describe('a large phone held sideways', () => {
	test.use({ viewport: { width: 932, height: 430 } });

	test.beforeEach(async ({ page }) => open(page));

	test('keeps the rail column and nothing spills', async ({ page }) => {
		await expect(page.locator('.layout')).not.toHaveClass(/narrow/);
		await expect(page.locator('.rail-scroll').first()).toBeVisible();
		expect(await sidewaysOverflow(page)).toEqual({ cut: 0, past: 0 });
	});
});
