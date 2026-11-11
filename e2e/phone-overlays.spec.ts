import { readFileSync, writeFileSync } from 'node:fs';
import { dump, load } from 'js-yaml';
import { expect, test, type Locator, type Page } from '@playwright/test';

/* Overlays on a phone: sheets fit, controls stay reachable, inputs do not zoom. */

const FAKE_HASS = `http://127.0.0.1:${process.env.E2E_HASS_PORT ?? 8124}`;
const HEARTH_FILE = new URL('./fixture/data/hearth.yaml', import.meta.url);
const HEARTH_FIXTURE = readFileSync(HEARTH_FILE, 'utf8');

type FixtureCard = { id: string; type: string } & Record<string, unknown>;

interface Fixture {
	rail: { id: string; type: string }[];
	rooms: { cards: FixtureCard[][] }[];
}

// the fixture has neither a media card nor a search widget; these tests need both
function withMediaAndSearch(...extraCards: FixtureCard[]) {
	const config = load(HEARTH_FIXTURE) as Fixture;
	config.rail.push({ id: 'search', type: 'search' });
	config.rooms[0].cards[0].push(
		{ id: 'music', type: 'media', entity: 'media_player.living' },
		...extraCards
	);
	return dump(config);
}

test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

test.beforeEach(async ({ page, request }) => {
	writeFileSync(HEARTH_FILE, withMediaAndSearch());
	await request.post(`${FAKE_HASS}/_test/reset`);
	await page.goto('/');
	await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();
});

test.afterEach(() => writeFileSync(HEARTH_FILE, HEARTH_FIXTURE));

/* the edit entry sits in the bottom bar's More menu on a phone */
async function startEditing(page: Page) {
	await page
		.getByRole('navigation', { name: 'Pages' })
		.getByRole('button', { name: 'More' })
		.click();
	await page.getByRole('button', { name: 'Edit dashboard' }).click();
}

async function openCardEditor(page: Page, title: string) {
	await startEditing(page);
	await page
		.locator('.card-slot', { hasText: title })
		.getByRole('button', { name: 'Edit' })
		.click();
	const sheet = page.getByRole('dialog', { name: 'Edit card' });
	await expect(sheet).toBeVisible();
	return sheet;
}

test('the media sheet gives the track the full width and stacks the queue under it', async ({
	page
}) => {
	await page.getByRole('button', { name: 'Open controls' }).click();
	const sheet = page.getByRole('dialog', { name: 'Living room speaker' });
	await expect(sheet).toBeVisible();

	const stage = (await sheet.locator('.stage').boundingBox())!;
	expect(stage.width).toBeGreaterThan(300);

	await expect(sheet.getByText('Blue in Green')).toBeInViewport();
	const play = sheet.locator('.transport .play');
	await expect(play).toBeInViewport();
	const playBox = (await play.boundingBox())!;
	expect(playBox.x + playBox.width).toBeLessThanOrEqual(375);

	// the panel sits below the stage rather than beside it
	const panel = (await sheet.locator('.panel').boundingBox())!;
	expect(panel.y).toBeGreaterThanOrEqual(stage.y + stage.height);
	expect(panel.width).toBeGreaterThan(300);

	// a finger landing just off the thin bar still scrubs
	const progress = (await sheet.locator('.progress').boundingBox())!;
	const hit = await page.evaluate(
		({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest('.progress')),
		{ x: progress.x + progress.width / 2, y: progress.y - 10 }
	);
	expect(hit).toBe(true);
});

/* what a tap at the middle of each control lands on: the control, not the tap area under it */
async function expectControlsAboveTapArea(page: Page, card: Locator, controls: string[]) {
	for (const control of controls) {
		const box = (await card.locator(control).first().boundingBox())!;
		const hit = await page.evaluate(
			({ x, y }) =>
				document.elementFromPoint(x, y)?.closest('.play, .progress, .tune, .shortcut, .open-hit')
					?.className ?? 'nothing',
			{ x: box.x + box.width / 2, y: box.y + box.height / 2 }
		);
		expect(hit, control).toContain(control.slice(1));
	}
}

test('a tap on the media card opens the full player, and its own controls do not', async ({
	page
}) => {
	const card = page.locator('.card:has(.open-hit)');
	const sheet = page.getByRole('dialog', { name: 'Living room speaker' });

	// the text lets the tap through to the card, so tap where the title is
	const title = (await card.locator('.title').boundingBox())!;
	await page.touchscreen.tap(title.x + title.width / 2, title.y + title.height / 2);
	await expect(sheet).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();

	// the transport, the seek bar and Open controls sit above the tap area
	await expectControlsAboveTapArea(page, card, ['.play', '.progress', '.tune']);
	// the transport tap must land (its label flips once the player's state
	// changes) before "the sheet stayed shut" means anything
	const play = card.locator('.play');
	const before = await play.getAttribute('aria-label');
	await play.tap();
	await expect(play).toHaveAttribute('aria-label', before === 'Pause' ? 'Play' : 'Pause');
	await expect(sheet).toBeHidden();
});

test('closing the player opened from the card leaves focus on a real control, not the tap area', async ({
	page
}) => {
	const card = page.locator('.card:has(.open-hit)');
	const sheet = page.getByRole('dialog', { name: 'Living room speaker' });

	// a mouse click is what focuses a button in Chrome and Firefox; the layer
	// restores focus to whatever was focused when it opened
	const title = (await card.locator('.title').boundingBox())!;
	await page.mouse.click(title.x + title.width / 2, title.y + title.height / 2);
	await expect(sheet).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();

	const focused = await page.evaluate(() => {
		const element = document.activeElement;
		return {
			hidden: Boolean(element?.closest('[aria-hidden="true"]')),
			hit: Boolean(element?.closest('.open-hit'))
		};
	});
	expect(focused).toEqual({ hidden: false, hit: false });
});

test('a short media card and one with a shortcut keep every control above the tap area', async ({
	page
}) => {
	const shortcuts = [{ name: 'Morning jazz', uri: 'spotify:playlist:morning' }];
	writeFileSync(
		HEARTH_FILE,
		withMediaAndSearch(
			{ id: 'short-music', type: 'media', entity: 'media_player.living', height: 150 },
			{
				id: 'shortcut-music',
				type: 'media',
				entity: 'media_player.living',
				height: 260,
				shortcuts
			}
		)
	);
	await page.reload();
	const cards = page.locator('.card:has(.open-hit)');

	const short = cards.nth(1);
	// centered, so the bottom bar does not cover the controls
	await short.evaluate((element) => element.scrollIntoView({ block: 'center' }));
	expect((await short.boundingBox())!.height).toBe(150);
	await expectControlsAboveTapArea(page, short, ['.play', '.progress', '.tune']);
	// a finger landing just off the thin bar still scrubs rather than opening the player
	const progress = (await short.locator('.progress').boundingBox())!;
	const hit = await page.evaluate(
		({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest('.progress')),
		{ x: progress.x + progress.width / 2, y: progress.y - 10 }
	);
	expect(hit).toBe(true);

	// a 150px card has no room for the shortcut row, which overflows its top
	// and is clipped, so the shortcut gets a taller card of its own
	const withShortcut = cards.nth(2);
	await withShortcut.evaluate((element) => element.scrollIntoView({ block: 'center' }));
	await expectControlsAboveTapArea(page, withShortcut, [
		'.shortcut',
		'.play',
		'.progress',
		'.tune'
	]);
});

test('the media card in the card editor preview takes no taps', async ({ page }) => {
	const editor = await openCardEditor(page, 'Blue in Green');
	const preview = editor.locator('.preview .card');
	await preview.scrollIntoViewIfNeeded();
	for (const target of ['.tune', '.art', '.play']) {
		const box = (await preview.locator(target).boundingBox())!;
		const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
		const onCard = await page.evaluate(
			({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest('.card')),
			point
		);
		expect(onCard, target).toBe(false);
		await page.touchscreen.tap(point.x, point.y);
	}
	await expect(page.getByRole('dialog', { name: 'Living room speaker' })).toHaveCount(0);
});

test.describe('at 320px', () => {
	test.use({ viewport: { width: 320, height: 640 } });

	test('a long sheet title truncates and keeps Close on screen', async ({ page }) => {
		const sheet = await openCardEditor(page, 'Lights');
		// every title is fixed copy; stand in for a long translation
		await sheet
			.locator('.header .title')
			.evaluate((node) => (node.textContent = 'Edit the card with a very long translated title'));

		const title = sheet.locator('.header .title');
		const overflow = await title.evaluate((node) => node.scrollWidth > node.clientWidth);
		expect(overflow).toBe(true);
		await expect(title).toHaveCSS('text-overflow', 'ellipsis');

		const close = sheet.getByRole('button', { name: 'Close' });
		await expect(close).toBeInViewport({ ratio: 1 });
		const closeBox = (await close.boundingBox())!;
		const sheetBox = (await sheet.boundingBox())!;
		expect(closeBox.x + closeBox.width).toBeLessThanOrEqual(sheetBox.x + sheetBox.width);
	});
});

test('text inputs are large enough that iOS does not zoom into them', async ({ page }) => {
	expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
	const fontSize = (selector: string) =>
		page
			.locator(selector)
			.first()
			.evaluate((node) => parseFloat(getComputedStyle(node).fontSize));

	await page
		.getByRole('navigation', { name: 'Pages' })
		.getByRole('button', { name: 'Search' })
		.click();
	const search = page.getByRole('dialog', { name: 'Search' });
	await expect(search).toBeVisible();
	expect(await fontSize('[role="dialog"] input')).toBeGreaterThanOrEqual(16);
	await page.keyboard.press('Escape');
	await expect(search).toBeHidden();

	const sheet = await openCardEditor(page, 'Lights');
	await expect(sheet.getByLabel('Title')).toBeVisible();
	expect(
		await sheet.getByLabel('Title').evaluate((node) => parseFloat(getComputedStyle(node).fontSize))
	).toBeGreaterThanOrEqual(16);
});

test('the viewport meta asks the keyboard to resize the page', async ({ page }) => {
	await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
		'content',
		/interactive-widget=resizes-content/
	);
});

test('the edit bar publishes its height for the toasts above it', async ({ page }) => {
	await startEditing(page);
	const bar = page.locator('.edit-bar');
	await expect(bar).toBeVisible();
	const height = (await bar.boundingBox())!.height;
	await expect
		.poll(() =>
			page.evaluate(() =>
				parseFloat(
					getComputedStyle(document.querySelector('.frame')!).getPropertyValue(
						'--h-edit-bar-height'
					)
				)
			)
		)
		.toBeCloseTo(height, 0);
});
