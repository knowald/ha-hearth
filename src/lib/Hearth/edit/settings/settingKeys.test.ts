import { describe, expect, it } from 'vitest';
import { SETTING_KEYS as alerts } from './AlertsSection.svelte';
import { SETTING_KEYS as appearance } from './AppearanceSection.svelte';
import { SETTING_KEYS as layout } from './LayoutSection.svelte';
import { SETTING_KEYS as pages } from './PagesSection.svelte';
import { SETTING_KEYS as size } from './SizeSection.svelte';
import { SETTING_KEYS as wallDisplay } from './WallDisplaySection.svelte';

describe('section setting keys', () => {
	it('gives each dashboard key to one section only', () => {
		const keys = [...appearance, ...layout, ...size, ...wallDisplay, ...alerts, ...pages];
		expect(new Set(keys).size).toBe(keys.length);
	});
});
