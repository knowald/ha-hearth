import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type APIRequestContext } from '@playwright/test';

/* The gauge card against the fake sensors in fake-hass.mjs. */

const FAKE_HASS = `http://127.0.0.1:${process.env.E2E_HASS_PORT ?? 8124}`;
const HEARTH_FILE = new URL('./fixture/data/hearth.yaml', import.meta.url);
const HEARTH_FIXTURE = readFileSync(HEARTH_FILE, 'utf8');

const WITH_GAUGES = `version: 5
revision: 1
rail:
  - id: nav
    type: nav
rooms:
  - id: home
    name: Home
    icon: home
    cards:
      - - id: humidity
          type: gauge
          entity: sensor.humidity
          segments:
            - from: 0
              color: bad
            - from: 30
              color: good
        - id: power
          type: gauge
          name: Power draw
          entity: sensor.power
          max: 200
          needle: true
`;

function setState(request: APIRequestContext, entity_id: string, state: string) {
	return request.post(`${FAKE_HASS}/_test/state`, { data: { entity_id, state } });
}

test.beforeEach(async ({ request }) => {
	writeFileSync(HEARTH_FILE, WITH_GAUGES);
	await request.post(`${FAKE_HASS}/_test/reset`);
});

test.afterEach(() => writeFileSync(HEARTH_FILE, HEARTH_FIXTURE));

test('shows the reading on its arc and opens the detail sheet on a tap', async ({ page }) => {
	await page.goto('/');
	const humidity = page.getByRole('button', { name: 'Humidity, 47%' });
	await expect(humidity).toBeVisible();
	await expect(humidity.locator('.fill')).toHaveCount(1);
	await expect(humidity.locator('.band')).toHaveCount(2);
	await humidity.click();
	await expect(page.getByRole('dialog', { name: 'Humidity' })).toBeVisible();
});

test('clamps the needle past the maximum and keeps the real reading', async ({ page }) => {
	await page.goto('/');
	const power = page.getByRole('button', { name: 'Power draw, 312 W' });
	await expect(power).toBeVisible();
	await expect(power.locator('.needle')).toHaveAttribute('style', /rotate\(90deg\)/);
	await expect(power.locator('.scale')).toContainText('312');
});

test('an unavailable sensor shows its state on an empty track', async ({ page, request }) => {
	await page.goto('/');
	await expect(page.getByRole('button', { name: 'Humidity, 47%' })).toBeVisible();
	await setState(request, 'sensor.humidity', 'unavailable');
	const card = page.locator('.gauge[data-entity="sensor.humidity"]');
	await expect(card.locator('.state')).toHaveText('Unavailable');
	await expect(card.locator('.track.empty')).toHaveCount(1);
	await expect(page.getByRole('button', { name: /^Humidity,/ })).toHaveCount(0);
});
