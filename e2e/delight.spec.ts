import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type APIRequestContext } from '@playwright/test';

const FAKE_HASS = `http://127.0.0.1:${process.env.E2E_HASS_PORT ?? 8124}`;
const HEARTH_FILE = new URL('./fixture/data/hearth.yaml', import.meta.url);
const HEARTH_FIXTURE = readFileSync(HEARTH_FILE, 'utf8');

// a fan and a colored light on one page, an energy widget whose statistic
// the fake server makes run low today, and a greeting for the one person
const DELIGHT = `version: 5
rail:
  - id: clock
    type: clock
  - id: nav
    type: nav
  - id: energy
    type: energy
    entity: sensor.energy_quiet_day
greeting:
  persons:
    - person.kevin
rooms:
  - id: office
    name: Office
    icon: desk
    cards:
      - - id: tiles
          type: entities
          entities:
            - entity: fan.bedroom
            - entity: light.strip
`;

function setState(request: APIRequestContext, entity_id: string, state: string) {
	return request.post(`${FAKE_HASS}/_test/state`, { data: { entity_id, state } });
}

test.beforeEach(async ({ request }) => {
	writeFileSync(HEARTH_FILE, DELIGHT);
	await request.post(`${FAKE_HASS}/_test/reset`);
	// the reset reports everyone as having just come home; start away instead
	await setState(request, 'person.kevin', 'not_home');
});

test.afterEach(() => writeFileSync(HEARTH_FILE, HEARTH_FIXTURE));

test('a running fan spins its tile icon until it stops', async ({ page, request }) => {
	// the fixture's configuration.yaml reduces motion; this screen asks for it back
	await page.addInitScript(() =>
		localStorage.setItem('hearthScreen', JSON.stringify({ reduce_motion: false }))
	);
	await page.goto('/');
	const fan = page.locator('.tile[data-entity="fan.bedroom"]');
	await expect(fan.locator('[data-icon-motion="spin"]')).toBeVisible();
	await expect(page.locator('.tile[data-entity="light.strip"] [data-icon-motion]')).toHaveAttribute(
		'data-icon-motion',
		'glow'
	);
	await setState(request, 'fan.bedroom', 'off');
	await expect(fan.locator('[data-icon-motion]')).toHaveCount(0);
});

test('tile icons stay still under reduced motion', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('.tile[data-entity="fan.bedroom"]')).toBeVisible();
	await expect(page.locator('[data-icon-motion]')).toHaveCount(0);
});

test('the header greets a person who comes home, until dismissed', async ({ page, request }) => {
	await page.goto('/');
	await expect(page.locator('.tile[data-entity="fan.bedroom"]')).toBeVisible();
	const greeting = page
		.getByRole('status')
		.filter({ hasText: /Good (morning|afternoon|evening|night), Kevin/ });
	await expect(greeting).toHaveCount(0);

	await setState(request, 'person.kevin', 'home');
	await expect(greeting).toBeVisible();
	await greeting.getByRole('button', { name: 'Dismiss' }).click();
	await expect(greeting).toHaveCount(0);
});

test('the energy widget marks a day below the 7-day average', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByText('Below your 7-day average')).toBeVisible();
});

test('an alert chimes only once the screen has been tapped', async ({ page, request }) => {
	writeFileSync(
		HEARTH_FILE,
		DELIGHT.replace(
			'rooms:\n',
			`alert_chimes:
  warning: bell
alerts:
  - id: door
    title: Front door open
    severity: warning
    conditions:
      - entity: binary_sensor.door
        state: "on"
rooms:
`
		)
	);
	// records the frequency of every note the page schedules
	await page.addInitScript(() => {
		const played: number[] = [];
		class RecordingContext {
			currentTime = 0;
			destination = {};
			resume = () => Promise.resolve();
			createOscillator = () => ({
				frequency: { setValueAtTime: (frequency: number) => played.push(frequency) },
				connect() {},
				start() {},
				stop() {}
			});
			createGain = () => ({
				gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
				connect() {}
			});
		}
		Object.assign(window, { played, AudioContext: RecordingContext });
	});
	await page.goto('/');
	const played = () => page.evaluate(() => (window as unknown as { played: number[] }).played);
	const alert = page.getByRole('alertdialog', { name: 'Front door open' });

	await setState(request, 'binary_sensor.door', 'on');
	await expect(alert).toBeVisible();
	expect(await played()).toEqual([]);

	// dismissing is the first tap, which lets the next alert chime
	await alert.getByRole('button', { name: 'Dismiss' }).click();
	await setState(request, 'binary_sensor.door', 'off');
	await setState(request, 'binary_sensor.door', 'on');
	await expect(alert).toBeVisible();
	await expect.poll(played).toEqual([880, 880 * 2.76]);
});
