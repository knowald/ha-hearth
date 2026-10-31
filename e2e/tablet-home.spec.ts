import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

/*
 * The tablet home: the rail clock's small day period, the page header's
 * readings and their editor, and the thermostat stepper on a temperature card.
 */

const FAKE_HASS = `http://127.0.0.1:${process.env.E2E_HASS_PORT ?? 8124}`;
const HEARTH_FILE = new URL('./fixture/data/hearth.yaml', import.meta.url);
const HEARTH_FIXTURE = readFileSync(HEARTH_FILE, 'utf8');

test.beforeEach(async ({ request }) => {
	await request.post(`${FAKE_HASS}/_test/reset`);
	writeFileSync(
		HEARTH_FILE,
		`version: 5
revision: 1
rail:
  - id: clock
    type: clock
    hour_format: '12'
  - id: nav
    type: nav
rooms:
  - id: office
    name: Office
    icon: desk
    columns: 1
    temp_entity: sensor.temperature
    humidity_entity: sensor.humidity
    cards:
      - - id: lights
          type: entities
          title: Lights
          entities:
            - entity: light.desk
        - id: inside
          type: temperature
          label: Inside
          entity: sensor.temperature
          climate_entity: climate.living
`
	);
});
test.afterEach(() => writeFileSync(HEARTH_FILE, HEARTH_FIXTURE));

test('the 12-hour rail clock sets AM or PM small beside the time', async ({ page }) => {
	await page.clock.setFixedTime(new Date('2026-10-31T17:09:00'));
	await page.goto('/');
	const clock = page.locator('.rail .clock').first();
	await expect(clock).toContainText('5:09');
	const period = clock.locator('.period');
	await expect(period).toHaveText('PM');
	const clockBox = (await clock.boundingBox())!;
	const periodBox = (await period.boundingBox())!;
	// one line, the period well under the digits' size
	expect(periodBox.height).toBeLessThan(clockBox.height / 2);
	expect(periodBox.y).toBeLessThan(clockBox.y + clockBox.height / 2);
});

test('the page header shows plain readings that the page editor lists', async ({ page }) => {
	await page.goto('/');
	const header = page.locator('.header-slot');
	await expect(header.locator('.stat')).toHaveText(['21.5\u00b0 Temp', '47% Humidity'], {
		useInnerText: true
	});

	await page.getByRole('button', { name: 'Edit Hearth configuration' }).click();
	await header.locator('[role="button"]').click();
	const sheet = page.getByRole('dialog', { name: 'Edit page' });
	await expect(sheet.getByText('Header readings')).toBeVisible();
	await sheet.getByRole('button', { name: 'Add reading' }).click();
	await sheet.getByLabel('Entity', { exact: true }).last().fill('sensor.power');
	await sheet.getByLabel('Label (optional)').last().fill('Power');
	await sheet.getByRole('button', { name: 'Move reading up' }).last().click();
	await sheet.getByRole('button', { name: 'Done' }).click();

	await expect(header.locator('.stat-label')).toHaveText(['Temp', 'Power', 'Humidity']);
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toHaveText('Saved');
	const saved = readFileSync(HEARTH_FILE, 'utf8');
	expect(saved).toContain('stats:');
	expect(saved).not.toContain('temp_entity');
});

test('the thermostat stepper shows the target once and steps it', async ({ page, request }) => {
	await page.goto('/');
	const card = page.locator('.card-slot[data-id="inside"]');
	const stepper = card.getByRole('group', { name: 'Target' });
	await expect(stepper).toContainText('21\u00b0C');
	await expect(card.getByText(/Target/i)).toHaveCount(1);
	const raise = stepper.getByRole('button', { name: 'Raise target' });
	const box = (await raise.boundingBox())!;
	expect(box.width).toBeGreaterThanOrEqual(44);
	expect(box.height).toBeGreaterThanOrEqual(44);

	await raise.click();
	await expect
		.poll(async () => {
			const calls: { domain: string; service: string; data: Record<string, unknown> }[] = await (
				await request.get(`${FAKE_HASS}/_test/calls`)
			).json();
			return calls.find((call) => call.service === 'set_temperature')?.data.temperature;
		})
		.toBe(21.5);
	await expect(stepper).toContainText('21.5\u00b0C');
});
