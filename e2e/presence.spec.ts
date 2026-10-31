import { expect, test, type APIRequestContext } from '@playwright/test';

const FAKE_HASS = `http://127.0.0.1:${process.env.E2E_HASS_PORT ?? 8124}`;
const SENSOR = 'binary_sensor.motion';

function setState(request: APIRequestContext, state: string) {
	return request.post(`${FAKE_HASS}/_test/state`, { data: { entity_id: SENSOR, state } });
}

test.beforeEach(({ request }) => request.post(`${FAKE_HASS}/_test/reset`));

test('a presence sensor keeps the screen black while nobody is around', async ({
	page,
	request
}) => {
	await page.goto('/');
	await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();
	await page.getByRole('button', { name: 'This screen', exact: true }).click();
	const sheet = page.getByRole('dialog', { name: 'This screen' });
	const field = sheet.getByLabel('Presence sensor', { exact: true });
	await field.fill(SENSOR);
	await field.blur();
	const fade = sheet.getByLabel('Presence fade');
	await expect(fade).toHaveValue('2');
	await fade.selectOption('10');
	await sheet.getByRole('button', { name: 'Close' }).first().click();
	await expect(sheet).toBeHidden();

	const html = page.locator('html');
	const screensaver = page.getByRole('button', { name: 'Dismiss sleep screen' });
	await setState(request, 'off');
	await expect(html).toHaveAttribute('data-sleep-timer', 'blank');
	await expect(screensaver).toHaveCSS('background-color', 'rgb(0, 0, 0)');
	await expect(screensaver.locator('.clock')).toHaveCount(0);

	// the fixture's sleep screen is off, so arriving shows the dashboard
	await setState(request, 'on');
	await expect(screensaver).toBeHidden();
	await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();

	// kept in this browser across reloads
	await setState(request, 'off');
	await page.reload();
	await expect(html).toHaveAttribute('data-sleep-timer', 'blank');
	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('hearthScreen') ?? '{}'))
	).toMatchObject({ presence_fade_seconds: 10 });
});

test('the settings show what the sensor reads, and a dimmed sleep screen replaces black', async ({
	page,
	request
}) => {
	await page.addInitScript(() =>
		localStorage.setItem(
			'hearthScreen',
			JSON.stringify({ presence_entity: 'binary_sensor.motion', presence_delay_minutes: 1 })
		)
	);
	await page.goto('/');
	await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();
	await page.getByRole('button', { name: 'This screen', exact: true }).click();
	const sheet = page.getByRole('dialog', { name: 'This screen' });
	await expect(sheet.getByText(/^Now: someone is around, changed/)).toBeVisible();
	await sheet.getByLabel('While nobody is around').selectOption('dim');
	await setState(request, 'off');
	await expect(sheet.getByText(/^Now: nobody around, the screen changes in /)).toBeVisible();

	const html = page.locator('html');
	await expect(html).not.toHaveAttribute('data-sleep-timer', 'dimmed');
	// the minute has not passed, so dropping the wait dims the screen at once
	await sheet.getByLabel('Nobody around after').selectOption('0');
	await expect(html).toHaveAttribute('data-sleep-timer', 'dimmed');
	const screensaver = page.getByRole('button', { name: 'Dismiss sleep screen' });
	await expect(screensaver.locator('.clock')).toBeVisible();
	await expect(screensaver.locator('.blackout')).toHaveCSS('opacity', '0.67');
});
