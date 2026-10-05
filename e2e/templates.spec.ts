import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/* Template cards and templated tile text, rendered by the fake render_template. */

const FAKE_HASS = `http://127.0.0.1:${process.env.E2E_HASS_PORT ?? 8124}`;
const HEARTH_FILE = new URL('./fixture/data/hearth.yaml', import.meta.url);
const HEARTH_FIXTURE = readFileSync(HEARTH_FILE, 'utf8');

const WITH_TEMPLATES = `version: 5
revision: 1
rail:
  - id: nav
    type: nav
rooms:
  - id: office
    name: Office
    icon: desk
    cards:
      - - id: note
          type: template
          title: Climate note
          icon: thermostat
          content: "**{{ states('sensor.temperature') }} C** inside <script>window.injected = true</script><img src=/hearth.svg onerror=\\"window.injected = true\\">"
        - id: broken
          type: template
          title: Broken note
          content: "{{ undefined_function() }}"
        - id: tiles
          type: entities
          title: Tiles
          entities:
            - entity: switch.fan
              name_template: "Fan is {{ states('switch.fan') }}"
              state_template: "{{ states('sensor.power') }} W"
            - entity: light.desk
`;

async function open(page: Page) {
	await page.goto('/');
	await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();
}

test.beforeEach(async ({ request }) => {
	writeFileSync(HEARTH_FILE, WITH_TEMPLATES);
	await request.post(`${FAKE_HASS}/_test/reset`);
});

test.afterEach(() => writeFileSync(HEARTH_FILE, HEARTH_FIXTURE));

test('a template card renders the Markdown Home Assistant returns, sanitized', async ({ page }) => {
	await open(page);
	const card = page.locator('.section', { hasText: 'Climate note' });
	await expect(card.locator('strong')).toHaveText('21.5 C');
	await expect(card).toContainText('inside');
	await expect(card.locator('script')).toHaveCount(0);
	await expect(card.locator('img')).not.toHaveAttribute('onerror');
	expect(await page.evaluate(() => (window as { injected?: boolean }).injected)).toBeUndefined();
});

test('a failing template stays quiet on the dashboard and explains itself in edit mode', async ({
	page
}) => {
	await open(page);
	const card = page.locator('.section', { hasText: 'Broken note' });
	await expect(card).toContainText('-');
	await expect(card).not.toContainText('UndefinedError');

	await page.getByRole('button', { name: 'Edit Hearth configuration' }).click();
	await expect(card).toContainText("Template error: UndefinedError: 'undefined_function'");
});

test('a tile shows its rendered name and state templates', async ({ page }) => {
	await open(page);
	const tile = page.getByRole('button', { name: /Fan is on/ });
	await expect(tile).toBeVisible();
	await expect(tile).toContainText('312 W');
	await expect(page.getByRole('button', { name: /Ceiling fan/ })).toHaveCount(0);
});
