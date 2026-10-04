import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/*
 * The quick editing paths: a tap opens a card's editor, the sheets duplicate
 * and move, a removal comes back from its toast, and pages can be added from
 * the phone strip.
 */

const HEARTH_FILE = new URL('./fixture/data/hearth.yaml', import.meta.url);
const HEARTH_FIXTURE = readFileSync(HEARTH_FILE, 'utf8');

/* a second page with two columns to move a card to */
function writeFixture() {
	writeFileSync(
		HEARTH_FILE,
		`version: 5
revision: 1
rail:
  - id: clock
    type: clock
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
          entities:
            - entity: light.desk
            - entity: light.shelf
        - id: readings
          type: entities
          title: Readings
          style: stat
          entities:
            - entity: sensor.temperature
  - id: kitchen
    name: Kitchen
    icon: kitchen
    columns: 2
    cards:
      - - id: frame
          type: iframe
          title: Frame
          url: about:blank
          height: 240
      - []
`
	);
}

async function startEditing(page: Page) {
	await page.goto('/');
	await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();
	await page.getByRole('button', { name: 'Edit Hearth configuration' }).click();
	await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
}

const cardIds = (page: Page) =>
	page
		.locator('.column > .card-slot')
		.evaluateAll((slots) => slots.map((slot) => (slot as HTMLElement).dataset.id));

test.beforeEach(() => writeFixture());
test.afterEach(() => writeFileSync(HEARTH_FILE, HEARTH_FIXTURE));

test('a tap on a card or one of its tiles opens the card editor', async ({ page }) => {
	await startEditing(page);
	await expect(page.getByText('Tap a card to edit it, drag the grip to move it')).toBeVisible();

	await page.locator('.card-slot[data-id="lights"]').getByText('Desk lamp').click();
	const sheet = page.getByRole('dialog', { name: 'Edit card' });
	await expect(sheet).toBeVisible();
	await expect(sheet.getByLabel('Title')).toHaveValue('Lights');
	// opening an editor is the hint taken
	await expect(page.getByText('Tap a card to edit it, drag the grip to move it')).toBeHidden();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();

	// the grip still drags rather than opening anything
	const grip = page.locator('.card-slot[data-id="readings"] .chip .drag-handle');
	const target = (await page.locator('.card-slot[data-id="lights"]').boundingBox())!;
	await grip.hover();
	await page.mouse.down();
	await page.mouse.move(target.x + target.width / 2, target.y + 10, { steps: 12 });
	await page.mouse.up();
	await expect.poll(() => cardIds(page)).toEqual(['readings', 'lights']);
	await expect(sheet).toBeHidden();
});

test('a card is duplicated from its sheet', async ({ page }) => {
	await startEditing(page);
	await page.getByRole('button', { name: 'Edit Lights', exact: true }).click();
	const sheet = page.getByRole('dialog', { name: 'Edit card' });
	await sheet.getByRole('button', { name: 'Duplicate' }).click();
	// the copy's editor opens in place of the original's, holding the same fields
	await expect(sheet.getByLabel('Title')).toHaveValue('Lights');
	await sheet.getByLabel('Title').fill('Lights copy');
	await sheet.getByRole('button', { name: 'Done' }).click();
	await expect(sheet).toBeHidden();
	const ids = await cardIds(page);
	expect(ids).toHaveLength(3);
	expect(new Set(ids).size).toBe(3);
	// the original kept its id, title and tiles; the copy sits after it with the same tiles
	expect(ids[0]).toBe('lights');
	const copy = page.locator(`.card-slot[data-id="${ids[1]}"]`);
	await expect(copy).toContainText('Lights copy');
	await expect(copy.locator('.entity-slot')).toHaveCount(2);
	await expect(page.locator('.card-slot[data-id="lights"]')).not.toContainText('Lights copy');
});

test('a card moves to another page and column', async ({ page }) => {
	await startEditing(page);
	await page.getByRole('button', { name: 'Edit Readings', exact: true }).click();
	const sheet = page.getByRole('dialog', { name: 'Edit card' });
	await sheet.getByRole('combobox', { name: 'Page', exact: true }).selectOption('kitchen');
	await sheet.getByRole('combobox', { name: 'Column', exact: true }).selectOption('1');
	await sheet.getByRole('button', { name: 'Done' }).click();
	await expect(sheet).toBeHidden();
	expect(await cardIds(page)).toEqual(['lights']);

	await page
		.locator('.room-list')
		.getByRole('button', { name: /Kitchen/ })
		.click();
	await expect(page.locator('.column').nth(1).locator('.card-slot')).toHaveAttribute(
		'data-id',
		'readings'
	);
	// a move is one step in the history
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(page.locator('.card-slot[data-id="readings"]')).toHaveCount(0);
});

test('a removed card comes back from the toast', async ({ page }) => {
	await startEditing(page);
	await page.locator('.card-slot[data-id="readings"]').click();
	const sheet = page.getByRole('dialog', { name: 'Edit card' });
	await sheet.getByRole('button', { name: 'Remove', exact: true }).click();
	await expect(sheet).toBeHidden();
	await expect(page.getByRole('alertdialog')).toHaveCount(0);
	expect(await cardIds(page)).toEqual(['lights']);

	await page.locator('.undo-toast').getByRole('button', { name: 'Undo' }).click();
	await expect.poll(() => cardIds(page)).toEqual(['lights', 'readings']);
	await expect(page.locator('.undo-toast')).toBeHidden();
});

test('Save says when there are unsaved edits', async ({ page }) => {
	await startEditing(page);
	const save = page.getByRole('button', { name: 'Save', exact: true });
	await expect(save.locator('.unsaved-dot')).toHaveCount(0);
	await expect(save).not.toHaveAccessibleDescription('Unsaved changes');

	await page.locator('.card-slot[data-id="readings"]').click();
	await page
		.getByRole('dialog', { name: 'Edit card' })
		.getByRole('button', { name: 'Remove', exact: true })
		.click();
	await expect(save.locator('.unsaved-dot')).toBeVisible();
	await expect(save).toHaveAccessibleDescription('Unsaved changes');
	await expect(save).toBeEnabled();
});

test('a stack is framed and its chip stays clear of its cards', async ({ page }) => {
	await startEditing(page);
	await page.getByRole('button', { name: 'Add stack' }).click();
	await page
		.getByRole('dialog', { name: 'Add stack' })
		.getByRole('button', { name: 'Done' })
		.click();
	const stack = page.locator('.stack-slot');
	await expect(stack).toHaveCSS('outline-style', 'dashed');
	await expect(stack.locator('.group-label .chip')).toContainText('Stack');

	// drop a card in so there is a card chip to stay clear of
	await stack.getByRole('button', { name: 'Add card' }).click();
	const sheet = page.getByRole('dialog', { name: 'Add card' });
	await sheet.getByRole('option', { name: /^Entities\b/ }).click();
	await sheet.getByRole('button', { name: 'Done' }).click();
	const stackChip = (await stack.locator('.group-label .chip').boundingBox())!;
	const cardChip = (await stack.locator('.card-slot .chip').boundingBox())!;
	const overlaps =
		stackChip.x < cardChip.x + cardChip.width &&
		cardChip.x < stackChip.x + stackChip.width &&
		stackChip.y < cardChip.y + cardChip.height &&
		cardChip.y < stackChip.y + stackChip.height;
	expect(overlaps).toBe(false);
});

test('a tap on embedded content opens its card', async ({ page }) => {
	await startEditing(page);
	await page
		.locator('.room-list')
		.getByRole('button', { name: /Kitchen/ })
		.click();
	const frame = page.locator('.card-slot[data-id="frame"] iframe');
	await expect(frame).toHaveCSS('pointer-events', 'none');
	const box = (await frame.boundingBox())!;
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	await expect(page.getByRole('dialog', { name: 'Edit card' })).toBeVisible();
});

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

	test('a page is added from the page strip', async ({ page }) => {
		await startEditing(page);
		await page.locator('.phone-nav').getByRole('button', { name: 'Add page' }).click();
		const sheet = page.getByRole('dialog', { name: 'Add page' });
		await sheet.getByLabel('Name').fill('Garage');
		await sheet.getByRole('button', { name: 'Done' }).click();
		await expect(sheet).toBeHidden();
		await expect(page.locator('.phone-nav').getByRole('button', { name: /Garage/ })).toBeVisible();
	});

	test('a scroll that starts on a card does not open it', async ({ page }) => {
		await startEditing(page);
		const card = (await page.locator('.card-slot[data-id="lights"]').boundingBox())!;
		const start = { x: card.x + card.width / 2, y: card.y + card.height / 2 };
		const session = await page.context().newCDPSession(page);
		await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
		for (let step = 1; step <= 10; step += 1) {
			await session.send('Input.dispatchTouchEvent', {
				type: 'touchMove',
				touchPoints: [{ x: start.x, y: start.y - step * 20 }]
			});
		}
		await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
		await session.detach();
		await page.waitForTimeout(300);
		await expect(page.getByRole('dialog')).toHaveCount(0);

		// a plain tap on the same card still opens it, wherever the scroll left it
		const moved = (await page.locator('.card-slot[data-id="lights"]').boundingBox())!;
		await page.touchscreen.tap(moved.x + moved.width / 2, moved.y + moved.height / 2);
		await expect(page.getByRole('dialog', { name: 'Edit card' })).toBeVisible();
	});
});
