import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

/* Configured tap and hold actions, and running scenes and scripts from search. */

const FAKE_HASS = `http://127.0.0.1:${process.env.E2E_HASS_PORT ?? 8124}`;
const HEARTH_FILE = new URL('./fixture/data/hearth.yaml', import.meta.url);
const HEARTH_FIXTURE = readFileSync(HEARTH_FILE, 'utf8');

// the hold_action below is pasted Lovelace spelling, path included
const WITH_ACTIONS = `version: 5
revision: 1
rail:
  - id: nav
    type: nav
  - id: search
    type: search
rooms:
  - id: office
    name: Office
    icon: desk
    cards:
      - - id: actions
          type: entities
          title: Actions
          entities:
            - entity: switch.fan
              tap_action:
                action: call-service
                service: script.turn_on
                service_data:
                  entity_id: script.goodnight
              hold_action:
                action: navigate
                navigation_path: /lovelace/kitchen
            - entity: input_boolean.guest
              tap_action:
                action: url
                url_path: /local/guest.html
            - entity: light.desk
  - id: kitchen
    name: Kitchen
    icon: kitchen
    cards:
      - - id: kitchen-lights
          type: entities
          title: Kitchen lights
          entities:
            - entity: light.shelf
`;

interface ServiceCall {
	domain: string;
	service: string;
	data: Record<string, unknown>;
}

async function serviceCalls(request: APIRequestContext): Promise<ServiceCall[]> {
	return (await request.get(`${FAKE_HASS}/_test/calls`)).json();
}

async function open(page: Page) {
	await page.goto('/');
	await expect(page.getByRole('button', { name: /Ceiling fan/ })).toBeVisible();
}

test.beforeEach(async ({ request }) => {
	writeFileSync(HEARTH_FILE, WITH_ACTIONS);
	await request.post(`${FAKE_HASS}/_test/reset`);
});

test.afterEach(() => writeFileSync(HEARTH_FILE, HEARTH_FIXTURE));

test('a tap action calls its service instead of toggling the tile', async ({ page, request }) => {
	await open(page);
	await page.getByRole('button', { name: /Ceiling fan/ }).click();
	await expect
		.poll(() => serviceCalls(request))
		.toEqual([{ domain: 'script', service: 'turn_on', data: { entity_id: 'script.goodnight' } }]);
});

test('a tile without actions keeps its own tap', async ({ page, request }) => {
	await open(page);
	await page.getByRole('button', { name: /Desk lamp/ }).click();
	await expect
		.poll(async () => (await serviceCalls(request)).map((call) => call.data.entity_id))
		.toEqual(['light.desk']);
});

test('a hold action switches to the page a Lovelace path names', async ({ page, request }) => {
	await open(page);
	const tile = page.getByRole('button', { name: /Ceiling fan/ });
	const box = (await tile.boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await expect(page.getByText('Kitchen lights')).toBeVisible();
	await page.mouse.up();
	await expect(page).toHaveURL(/room=kitchen/);
	// the release after the hold is not a tap
	expect(await serviceCalls(request)).toEqual([]);
});

test('a url action opens a new tab', async ({ page, context }) => {
	await open(page);
	const opened = context.waitForEvent('page');
	await page.getByRole('button', { name: /Guest mode/ }).click();
	expect((await opened).url()).toContain('/local/guest.html');
});

test('search runs a scene on Enter', async ({ page, request }) => {
	await open(page);
	await page.getByRole('button', { name: 'Search' }).click();
	const search = page.getByRole('dialog', { name: 'Search' });
	await search.getByRole('textbox').fill('movie night');
	await expect(search.getByRole('button', { name: 'Run Movie night' })).toBeVisible();
	await page.keyboard.press('Enter');
	await expect(search).toBeHidden();
	await expect
		.poll(() => serviceCalls(request))
		.toEqual([{ domain: 'scene', service: 'turn_on', data: { entity_id: 'scene.movie' } }]);
});
