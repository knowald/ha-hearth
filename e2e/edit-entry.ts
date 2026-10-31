import type { Page } from '@playwright/test';

/*
 * The edit and This screen entries float at the rail's foot on a wide screen
 * and sit in the bottom bar's More menu once the layout folds (900 px and
 * narrower, see src/lib/Hearth/breakpoints.ts). Class selectors rather than
 * names, so a test running in another language finds them too.
 */

function folded(page: Page) {
	return (page.viewportSize()?.width ?? 1280) <= 900;
}

async function openMenu(page: Page) {
	await page.locator('.phone-bar .more').click();
}

export async function clickEditEntry(page: Page) {
	if (!folded(page)) {
		await page.locator('.edit-entry .edit-toggle').click();
		return;
	}
	await openMenu(page);
	await page.locator('.menu .edit-toggle').click();
}

export async function clickScreenEntry(page: Page) {
	if (!folded(page)) {
		await page.locator('.edit-entry .screen-toggle').click();
		return;
	}
	await openMenu(page);
	await page.locator('.menu .screen-toggle').click();
}
