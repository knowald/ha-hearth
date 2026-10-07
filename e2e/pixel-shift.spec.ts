import { expect, test } from '@playwright/test';

for (const screen of [
	{ name: 'tablet', width: 1280, height: 800, scale: 100 },
	{ name: 'phone', width: 390, height: 844, scale: 100 },
	{ name: 'scaled tablet', width: 1280, height: 800, scale: 150 }
]) {
	test(`pixel shifting stays within the ${screen.name} viewport and pauses for dialogs`, async ({
		page
	}) => {
		await page.setViewportSize({ width: screen.width, height: screen.height });
		await page.addInitScript(
			({ scale }) => {
				if (sessionStorage.getItem('pixelShiftSeeded')) return;
				sessionStorage.setItem('pixelShiftSeeded', '1');
				localStorage.setItem(
					'hearthScreen',
					JSON.stringify({
						pixel_shift: true,
						screensaver_minutes: 0,
						scale,
						reduce_motion: true
					})
				);
			},
			{ scale: screen.scale }
		);
		await page.clock.install();
		await page.goto('/');
		await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();
		const frame = page.locator('.frame');
		const layout = page.locator('.layout');
		const initial = await layout.boundingBox();
		await page.clock.fastForward('01:00');
		await expect(frame).toHaveCSS('--h-shift-x', `calc(-4px / ${screen.scale / 100})`);
		const shifted = await layout.boundingBox();
		expect(shifted!.x - initial!.x).toBeCloseTo(-4, 1);
		expect(shifted!.y - initial!.y).toBeCloseTo(4, 1);
		for (let minute = 0; minute < 9; minute++) {
			const box = await layout.boundingBox();
			expect(box!.x).toBeGreaterThanOrEqual(-0.1);
			expect(box!.y).toBeGreaterThanOrEqual(-0.1);
			expect(box!.x + box!.width).toBeLessThanOrEqual(screen.width + 0.1);
			expect(box!.y + box!.height).toBeLessThanOrEqual(screen.height + 0.1);
			await page.clock.fastForward('01:00');
		}
		await page.getByRole('button', { name: 'This screen', exact: true }).click();
		const sheet = page.getByRole('dialog', { name: 'This screen' });
		await expect(sheet).toBeVisible();
		const held = await layout.boundingBox();
		await page.clock.fastForward('02:00');
		expect(await layout.boundingBox()).toEqual(held);
		await sheet.getByRole('switch', { name: 'Pixel shifting' }).click();
		await expect(frame).not.toHaveClass(/pixel-shifting/);
		await page.reload();
		await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();
		await expect(frame).not.toHaveClass(/pixel-shifting/);
	});
}

test('sleep-screen content keeps shifting with reduced motion enabled', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem(
			'hearthScreen',
			JSON.stringify({
				pixel_shift: true,
				screensaver_minutes: 1,
				reduce_motion: true
			})
		);
	});
	await page.clock.install();
	await page.goto('/');
	await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();
	await page.clock.fastForward('01:05');
	const sleep = page.getByRole('button', { name: 'Dismiss sleep screen' });
	await expect(sleep).toBeVisible();
	const content = sleep.locator('.screensaver-content');
	await expect(content).toHaveCSS('translate', '-4px 4px');
	await page.clock.fastForward('01:00');
	await expect(content).toHaveCSS('translate', '1px -1px');
	await sleep.click();
	await expect(sleep).toBeHidden();
	await expect(page.getByRole('button', { name: /Desk lamp/ })).toBeVisible();
});
