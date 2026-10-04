import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

/* Home Assistant driving the dashboard: HEARTH events, page visibility, style rules. */

const FAKE_HASS = `http://127.0.0.1:${process.env.E2E_HASS_PORT ?? 8124}`;
const HEARTH_FILE = new URL('./fixture/data/hearth.yaml', import.meta.url);
const HEARTH_FIXTURE = readFileSync(HEARTH_FILE, 'utf8');

// a document of its own rather than an edit of the shared one: other specs save into that file
const DOCUMENT = `version: 5
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
    cards:
      - - id: lights
          type: entities
          title: Lights
          entities:
            - entity: light.desk
            - entity: lock.front
              style:
                - conditions:
                    - entity: lock.front
                      state: unlocked
                  color: '#e53935'
                  icon: lock_open
                  class: front-open
  - id: cameras
    name: Cameras
    icon: videocam
    cards: []
  - id: night
    name: Night
    icon: bedtime
    visibility:
      - time:
          after: '22:00'
          before: '06:00'
    cards: []
`;

function fire(request: APIRequestContext, data: Record<string, unknown>) {
	return request.post(`${FAKE_HASS}/_test/fire_event`, { data });
}

async function open(page: Page) {
	await page.goto('/');
	await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();
}

test.beforeEach(async ({ request }) => {
	writeFileSync(HEARTH_FILE, DOCUMENT);
	await request.post(`${FAKE_HASS}/_test/reset`);
});

test.afterEach(() => writeFileSync(HEARTH_FILE, HEARTH_FIXTURE));

test('a navigate event shows the page it names', async ({ page, request }) => {
	await open(page);
	await fire(request, { action: 'navigate', page: 'Cameras' });
	await expect(page.locator('[data-page="cameras"]')).toBeVisible();
	await expect(page).toHaveURL(/room=cameras/);

	// another screen's event leaves this one alone
	await fire(request, { action: 'navigate', page: 'office', device: 'garage' });
	await page.waitForTimeout(300);
	await expect(page.locator('[data-page="cameras"]')).toBeVisible();
});

test('sleep and wake events start and end the sleep screen', async ({ page, request }) => {
	await open(page);
	const screensaver = page.getByRole('button', { name: 'Dismiss sleep screen' });
	await fire(request, { action: 'sleep' });
	await expect(screensaver).toBeVisible();
	await fire(request, { action: 'wake' });
	await expect(screensaver).toHaveCount(0);
});

test('a style rule colors a tile while its state matches', async ({ page, request }) => {
	await open(page);
	const tile = page.locator('[data-entity="lock.front"]');
	await expect(tile).toHaveAttribute('data-state', 'locked');
	await expect(page.locator('.front-open')).toHaveCount(0);

	await request.post(`${FAKE_HASS}/_test/state`, {
		data: { entity_id: 'lock.front', state: 'unlocked' }
	});
	await expect(tile).toHaveAttribute('data-state', 'unlocked');
	await expect(page.locator('.front-open')).toHaveCount(1);
	await expect(tile.locator('.mi').first()).toHaveText('lock_open');
	await expect(tile.locator('.mi').first()).toHaveCSS('color', 'rgb(229, 57, 53)');
});

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

	test('a page hidden by a time condition stays out of the page strip until its time', async ({
		page
	}) => {
		await page.clock.setFixedTime(new Date('2026-10-02T21:59:00'));
		await open(page);
		const strip = page.getByRole('navigation', { name: 'Pages' });
		await expect(strip.getByRole('button', { name: 'Cameras' })).toBeVisible();
		await expect(strip.getByRole('button', { name: 'Night' })).toHaveCount(0);

		// the shared minute clock picks up the new minute
		await page.clock.setFixedTime(new Date('2026-10-02T22:00:00'));
		await expect(strip.getByRole('button', { name: 'Night' })).toBeVisible();
	});
});
