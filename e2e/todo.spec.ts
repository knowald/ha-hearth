import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

/* The to-do list card against the fake list in fake-hass.mjs. */

const FAKE_HASS = `http://127.0.0.1:${process.env.E2E_HASS_PORT ?? 8124}`;
const HEARTH_FILE = new URL('./fixture/data/hearth.yaml', import.meta.url);
const HEARTH_FIXTURE = readFileSync(HEARTH_FILE, 'utf8');

const WITH_TODO = `version: 5
revision: 1
rail:
  - id: nav
    type: nav
  - id: search
    type: search
rooms:
  - id: kitchen
    name: Kitchen
    icon: kitchen
    cards:
      - - id: shopping
          type: todo
          entity: todo.shopping
          title: Groceries
`;

interface ServiceCall {
	domain: string;
	service: string;
	data: Record<string, unknown>;
}

async function todoCalls(request: APIRequestContext): Promise<ServiceCall[]> {
	const calls: ServiceCall[] = await (await request.get(`${FAKE_HASS}/_test/calls`)).json();
	return calls.filter((call) => call.domain === 'todo');
}

async function open(page: Page) {
	await page.goto('/');
	const card = page.getByRole('region', { name: 'Groceries' });
	await expect(card.getByRole('checkbox', { name: 'Milk' })).toBeVisible();
	return card;
}

test.beforeEach(async ({ request }) => {
	writeFileSync(HEARTH_FILE, WITH_TODO);
	await request.post(`${FAKE_HASS}/_test/reset`);
});

test.afterEach(() => writeFileSync(HEARTH_FILE, HEARTH_FIXTURE));

test('shows open items with their due date and folds completed ones away', async ({ page }) => {
	const card = await open(page);
	await expect(card.getByText('2 open')).toBeVisible();
	await expect(card.getByRole('checkbox', { name: 'Bread' })).toBeVisible();
	await expect(card.locator('.due')).toHaveCount(1);
	await expect(card.getByRole('checkbox', { name: 'Coffee' })).toBeHidden();
	await card.getByRole('button', { name: 'Completed (1)' }).click();
	await expect(card.getByRole('checkbox', { name: 'Coffee' })).toBeChecked();
});

test('adds an item on Enter', async ({ page, request }) => {
	const card = await open(page);
	const field = card.getByRole('textbox', { name: 'Add an item' });
	await field.fill('Eggs');
	await field.press('Enter');
	await expect(field).toHaveValue('');
	await expect(card.getByRole('checkbox', { name: 'Eggs' })).toBeVisible();
	await expect
		.poll(() => todoCalls(request))
		.toEqual([
			{ domain: 'todo', service: 'add_item', data: { entity_id: 'todo.shopping', item: 'Eggs' } }
		]);
	await expect(card.getByText('3 open')).toBeVisible();
});

test('completing an item moves it to the completed section', async ({ page, request }) => {
	const card = await open(page);
	await card.getByRole('checkbox', { name: 'Milk' }).click();
	await expect(card.getByRole('button', { name: 'Completed (2)' })).toBeVisible();
	await expect(card.getByRole('checkbox', { name: 'Milk' })).toBeHidden();
	await expect
		.poll(() => todoCalls(request))
		.toEqual([
			{
				domain: 'todo',
				service: 'update_item',
				data: { entity_id: 'todo.shopping', item: 'milk', status: 'completed' }
			}
		]);
	await card.getByRole('button', { name: 'Completed (2)' }).click();
	await expect(card.getByRole('checkbox', { name: 'Milk' })).toBeChecked();
});

test('a long press deletes an item after confirmation', async ({ page, request }) => {
	const card = await open(page);
	const bread = card.getByRole('button', { name: 'Bread' });
	const box = (await bread.boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	const dialog = page.getByRole('alertdialog');
	await expect(dialog).toContainText('Remove "Bread" from the list?');
	await page.mouse.up();
	// the release after the hold is not a tap that starts renaming
	await expect(card.getByRole('textbox', { name: 'Rename Bread' })).toBeHidden();
	await dialog.getByRole('button', { name: 'Remove' }).click();
	await expect(card.getByRole('checkbox', { name: 'Bread' })).toBeHidden();
	await expect
		.poll(() => todoCalls(request))
		.toEqual([
			{
				domain: 'todo',
				service: 'remove_item',
				data: { entity_id: 'todo.shopping', item: ['bread'] }
			}
		]);
});

test('renames an item in place', async ({ page, request }) => {
	const card = await open(page);
	await card.getByRole('button', { name: 'Milk' }).click();
	const field = card.getByRole('textbox', { name: 'Rename Milk' });
	await field.fill('Oat milk');
	await field.press('Enter');
	await expect(card.getByRole('checkbox', { name: 'Oat milk' })).toBeVisible();
	await expect
		.poll(() => todoCalls(request))
		.toEqual([
			{
				domain: 'todo',
				service: 'update_item',
				data: { entity_id: 'todo.shopping', item: 'milk', rename: 'Oat milk' }
			}
		]);
});

test('search lists the to-do list like any entity', async ({ page }) => {
	await open(page);
	await page.getByRole('button', { name: 'Search' }).click();
	const search = page.getByRole('dialog', { name: 'Search' });
	await search.getByRole('textbox').fill('shopping');
	await expect(search.getByText('Shopping list')).toBeVisible();
});

test('the list ignores taps in edit mode', async ({ page, request }) => {
	const card = await open(page);
	await page.getByRole('button', { name: 'Edit Hearth configuration' }).click();
	// inert passes the tap to whatever the card sits in
	await card.getByText('Milk').click({ force: true });
	await expect(card.getByRole('textbox', { name: 'Rename Milk' })).toBeHidden();
	expect(await todoCalls(request)).toEqual([]);
});
