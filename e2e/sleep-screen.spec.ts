import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Page, type Route } from '@playwright/test';

const FAKE_HASS = `http://127.0.0.1:${process.env.E2E_HASS_PORT ?? 8124}`;
const SETTINGS_FILE = new URL('./fixture/data/configuration.yaml', import.meta.url);
const SETTINGS_FIXTURE = readFileSync(SETTINGS_FILE, 'utf8');
const HEARTH_FILE = new URL('./fixture/data/hearth.yaml', import.meta.url);
const HEARTH_FIXTURE = readFileSync(HEARTH_FILE, 'utf8');
// a transparent 1x1 PNG stands in for every map and radar tile
const TILE = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
	'base64'
);

/** Answers RainViewer and the basemap from here, so the test never reaches the network. */
async function mockMapServices(
	page: Page,
	past = [
		{ time: 1790515800, path: '/v2/radar/older' },
		{ time: 1790516400, path: '/v2/radar/newer' }
	]
) {
	const radarTiles: string[] = [];
	const basemapTiles: string[] = [];
	const basemapReferers: (string | undefined)[] = [];
	const tile = (seen: string[]) => (route: Route) => {
		seen.push(route.request().url());
		return route.fulfill({ body: TILE, contentType: 'image/png' });
	};
	await page.route('https://api.rainviewer.com/**', (route) =>
		route.fulfill({
			json: {
				version: '2.0',
				generated: 1790516400,
				host: 'https://tilecache.rainviewer.com',
				radar: { past, nowcast: [] }
			}
		})
	);
	await page.route('https://tilecache.rainviewer.com/**', tile(radarTiles));
	await page.route('https://tile.openstreetmap.org/**', (route) => {
		basemapReferers.push(route.request().headers()['referer']);
		return tile(basemapTiles)(route);
	});
	return { radarTiles, basemapTiles, basemapReferers };
}

async function previewRadar(page: Page) {
	await page.getByRole('button', { name: 'Edit Hearth configuration' }).click();
	await page.getByRole('button', { name: 'Settings', exact: true }).click();
	const sheet = page.getByRole('dialog', { name: 'Settings' });
	await sheet.getByLabel('Background', { exact: true }).selectOption('radar');
	await sheet.getByRole('button', { name: 'Preview sleep screen' }).click();
	return { sheet, screensaver: page.getByRole('button', { name: 'Dismiss sleep screen' }) };
}

test.afterEach(() => {
	writeFileSync(SETTINGS_FILE, SETTINGS_FIXTURE);
	writeFileSync(HEARTH_FILE, HEARTH_FIXTURE);
});

test.beforeEach(async ({ page, request }) => {
	await request.post(`${FAKE_HASS}/_test/reset`);
	await page.goto('/');
	await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();
});

test('previews the sleep screen over a weather radar map and wakes on a tap', async ({ page }) => {
	const { radarTiles, basemapTiles, basemapReferers } = await mockMapServices(page);
	await page.getByRole('button', { name: 'Edit Hearth configuration' }).click();
	await page.getByRole('button', { name: 'Settings', exact: true }).click();
	const sheet = page.getByRole('dialog', { name: 'Settings' });
	await sheet.getByLabel('Background', { exact: true }).selectOption('radar');
	await expect(sheet.getByRole('switch', { name: 'Use home location' })).toBeChecked();
	await sheet.getByRole('button', { name: 'Preview sleep screen' }).click();

	const screensaver = page.getByRole('button', { name: 'Dismiss sleep screen' });
	await expect(screensaver).toBeVisible();
	const map = screensaver.getByTestId('radar-map');
	await expect(screensaver.locator('.radar')).toHaveClass(/ready/);
	const attribution = map.locator('.leaflet-control-attribution');
	await expect(attribution).toContainText('RainViewer');
	await expect(attribution).toContainText('OpenStreetMap');
	// the Home Assistant home from fake-hass, drawn as the location marker
	await expect(map.locator('path.radar-home')).toHaveCount(1);
	expect(radarTiles.length).toBeGreaterThan(0);
	for (const url of radarTiles)
		expect(url).toMatch(/\/v2\/radar\/(older|newer)\/512\/\d+\/\d+\/\d+\/2\/1_1\.png$/);
	expect(basemapTiles.length).toBeGreaterThan(0);
	// OpenStreetMap blocks tile requests without a Referer
	expect(basemapReferers.every(Boolean)).toBe(true);
	await expect(screensaver.getByText(/^Radar /)).toBeVisible();
	await expect(map).toHaveClass(/dark/);

	await page.mouse.click(640, 400);
	await expect(screensaver).toBeHidden();
	await expect(sheet).toBeVisible();
});

test('an alert from Home Assistant wakes the radar sleep screen', async ({ page, request }) => {
	// alerts leave an edit session alone, so this sleep comes from the idle timer
	writeFileSync(
		HEARTH_FILE,
		`${HEARTH_FIXTURE}screensaver_minutes: 1\nscreensaver_background: radar\n`
	);
	await mockMapServices(page);
	await page.clock.install();
	await page.reload();
	await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();
	const screensaver = page.getByRole('button', { name: 'Dismiss sleep screen' });
	/*
	 * The sleep screen loads on demand and starts its idle timer when it
	 * mounts. A visible dashboard does not mean it has mounted yet, and a
	 * fast-forward that lands before its timer exists moves nothing.
	 */
	await expect(page.locator('html')).toHaveAttribute('data-sleep-timer', 'armed');
	await page.clock.fastForward('01:05');
	await expect(screensaver).toBeVisible();
	await expect(screensaver.getByTestId('radar-map')).toBeAttached();
	await request.post(`${FAKE_HASS}/_test/fire_event`, {
		data: { action: 'alert', tag: 'door', title: 'Front door open' }
	});
	await expect(screensaver).toBeHidden();
	await expect(page.getByText('Front door open').first()).toBeVisible();
});

test('falls back to a plain sleep screen when the radar is unreachable', async ({ page }) => {
	await page.route('https://api.rainviewer.com/**', (route) => route.abort('internetdisconnected'));
	await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
	await page.getByRole('button', { name: 'Edit Hearth configuration' }).click();
	await page.getByRole('button', { name: 'Settings', exact: true }).click();
	const sheet = page.getByRole('dialog', { name: 'Settings' });
	await sheet.getByLabel('Background', { exact: true }).selectOption('radar');
	await sheet.getByRole('button', { name: 'Preview sleep screen' }).click();

	const screensaver = page.getByRole('button', { name: 'Dismiss sleep screen' });
	await expect(screensaver).toBeVisible();
	await expect(screensaver.locator('.radar')).not.toHaveClass(/ready/);
	await expect(screensaver.locator('.radar')).toHaveCSS('opacity', '0');
	await expect(screensaver.locator('.scrim')).toHaveCount(0);
	await page.keyboard.press('Escape');
	await expect(screensaver).toBeHidden();
});

test('animates only the newest frames, loading them one after another', async ({ page }) => {
	const past = Array.from({ length: 13 }, (_, index) => ({
		time: 1790509200 + index * 600,
		path: `/v2/radar/frame${index}`
	}));
	const { radarTiles } = await mockMapServices(page, past);
	// the fixture turns motion off, which shows only the newest frame
	writeFileSync(SETTINGS_FILE, SETTINGS_FIXTURE.replace(/^motion: false$/m, 'motion: true'));
	await page.reload();
	await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();
	const { screensaver } = await previewRadar(page);
	await expect(screensaver.locator('.radar')).toHaveClass(/ready/);

	const label = screensaver.getByText(/^Radar /);
	const first = await label.textContent();
	await expect(label).not.toHaveText(first!, { timeout: 5000 });

	const requested = () =>
		new Set(radarTiles.map((url) => url.match(/\/v2\/radar\/(frame\d+)\//)![1]));
	await expect.poll(() => requested().size).toBe(6);
	expect([...requested()].sort()).toEqual(
		['frame7', 'frame8', 'frame9', 'frame10', 'frame11', 'frame12'].sort()
	);
	// six frames of a 1280x800 screen in 512 px tiles stay far under RainViewer's burst of 300
	expect(radarTiles.length).toBeLessThanOrEqual(6 * 12);
});

// two different single-pixel PNGs, so they store as two uploads
const PHOTOS = [
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
].map((base64) => Buffer.from(base64, 'base64'));

test('the photo frame steps through uploaded photos', async ({ page, request }) => {
	const files: string[] = [];
	for (const photo of PHOTOS) {
		const response = await request.post('/_api/hearth_images', {
			data: photo,
			headers: { 'Content-Type': 'image/png' }
		});
		expect(response.ok()).toBe(true);
		files.push((await response.json()).file);
	}
	try {
		writeFileSync(
			HEARTH_FILE,
			`${HEARTH_FIXTURE}screensaver_minutes: 1\nscreensaver_background: photos\n` +
				'screensaver_photo_order: sequence\nscreensaver_photo_seconds: 10\n' +
				`screensaver_photos:\n${files.map((file) => `  - hearth-images/${file}\n`).join('')}`
		);
		await page.clock.install();
		await page.reload();
		await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();
		await expect(page.locator('html')).toHaveAttribute('data-sleep-timer', 'armed');
		await page.clock.fastForward('01:05');
		const screensaver = page.getByRole('button', { name: 'Dismiss sleep screen' });
		const slide = screensaver.locator('img.slide');
		await expect(slide).toHaveAttribute('src', new RegExp(`/_api/hearth_images/${files[0]}$`));
		await expect
			.poll(() => slide.evaluate((image: HTMLImageElement) => image.naturalWidth))
			.toBe(1);
		await expect(screensaver.locator('.scrim')).toHaveCount(1);

		await page.clock.fastForward('00:10');
		await expect(slide).toHaveAttribute('src', new RegExp(`/_api/hearth_images/${files[1]}$`));
		await page.clock.fastForward('00:10');
		await expect(slide).toHaveAttribute('src', new RegExp(`/_api/hearth_images/${files[0]}$`));
	} finally {
		for (const file of files) await request.delete('/_api/hearth_images', { data: { file } });
	}
});

test('photos added in the settings play in the preview', async ({ page, request }) => {
	const before = new Set(
		((await (await request.get('/_api/hearth_images')).json()) as { file: string }[]).map(
			(image) => image.file
		)
	);
	try {
		await page.getByRole('button', { name: 'Edit Hearth configuration' }).click();
		await page.getByRole('button', { name: 'Settings', exact: true }).click();
		const sheet = page.getByRole('dialog', { name: 'Settings' });
		await sheet.getByLabel('Background', { exact: true }).selectOption('photos');
		await sheet.locator('input[type="file"][multiple]').setInputFiles(
			PHOTOS.map((buffer, index) => ({
				name: `photo-${index}.png`,
				mimeType: 'image/png',
				buffer
			}))
		);
		await expect(sheet.getByRole('button', { name: /^Remove photo/ })).toHaveCount(2);
		await sheet.getByRole('button', { name: 'Remove photo 1' }).click();
		await expect(sheet.getByRole('button', { name: /^Remove photo/ })).toHaveCount(1);

		await sheet.getByRole('button', { name: 'Preview sleep screen' }).click();
		const screensaver = page.getByRole('button', { name: 'Dismiss sleep screen' });
		await expect(screensaver.locator('img.slide')).toHaveAttribute(
			'src',
			/\/_api\/hearth_images\/[a-f0-9]{32}\.webp$/
		);
	} finally {
		const after = (await (await request.get('/_api/hearth_images')).json()) as { file: string }[];
		for (const { file } of after.filter((image) => !before.has(image.file)))
			await request.delete('/_api/hearth_images', { data: { file } });
	}
});

test('the now playing sleep screen shows the track while music plays', async ({
	page,
	request
}) => {
	await request.post(`${FAKE_HASS}/_test/state`, {
		data: {
			entity_id: 'media_player.living',
			attributes: { entity_picture: '/api/media_player_proxy/media_player.living?token=e2e' }
		}
	});
	writeFileSync(
		HEARTH_FILE,
		`${HEARTH_FIXTURE}screensaver_minutes: 1\nscreensaver_background: media\n` +
			'screensaver_media_fallback: sun\n'
	);
	await page.clock.install();
	await page.reload();
	await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();
	await expect(page.locator('html')).toHaveAttribute('data-sleep-timer', 'armed');
	await page.clock.fastForward('01:05');
	const screensaver = page.getByRole('button', { name: 'Dismiss sleep screen' });
	await expect(screensaver.getByText('Blue in Green')).toBeVisible();
	await expect(screensaver.getByText('Miles Davis')).toBeVisible();
	const art = screensaver.locator('img.art');
	await expect.poll(() => art.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1);
	await expect(screensaver.locator('img.art-backdrop')).toHaveCount(1);

	await request.post(`${FAKE_HASS}/_test/state`, {
		data: { entity_id: 'media_player.living', state: 'paused' }
	});
	// the track stays up a moment, so a skip between songs does not flash the fallback
	await expect(screensaver.locator('.sky')).toHaveCount(0);
	await page.clock.fastForward('00:06');
	await expect(screensaver.getByText('Blue in Green')).toBeHidden();
	await expect(screensaver.locator('.sky')).toHaveAttribute('data-phase', 'day');
});
