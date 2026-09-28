import { defineConfig } from '@playwright/test';
import matrix from './playwright.matrix.config';

/*
 * Renders the README device image from the matrix fixture. Run `pnpm build`
 * first, then `pnpm readme:image`; writes docs/images/devices.png.
 */
export default defineConfig({
	...matrix,
	testDir: './e2e/readme',
	outputDir: './matrix-output/.playwright-readme'
});
