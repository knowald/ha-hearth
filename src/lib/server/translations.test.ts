// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lang, translation } from '$lib/core/i18n';
import { listLocales, loadTranslations } from './translations';

let directory: string;

async function write(path: string, strings: Record<string, string>) {
	await writeFile(join(directory, path), JSON.stringify(strings));
}

beforeEach(async () => {
	directory = await mkdtemp(join(tmpdir(), 'hearth-translations-'));
	await mkdir(join(directory, 'hearth'));
	await write('en.json', { cancel: 'Cancel', language: 'Language' });
	await write('hearth/en.json', { hearth_save: 'Save', hearth_close: 'Close' });
	await write('de.json', { language: 'Sprache' });
	await write('hearth/de.json', { hearth_save: 'Speichern' });
	await write('fr.json', { language: 'Langue' });
});

afterEach(async () => {
	await rm(directory, { recursive: true, force: true });
});

describe('listLocales', () => {
	it('lists the Home Assistant files, not the hearth folder', async () => {
		expect(await listLocales(directory)).toEqual(['de', 'en', 'fr']);
	});
});

describe('loadTranslations', () => {
	it('merges both English files for English', async () => {
		expect(await loadTranslations('en', directory)).toEqual({
			cancel: 'Cancel',
			language: 'Language',
			hearth_save: 'Save',
			hearth_close: 'Close'
		});
	});

	it('lays a locale over English key by key', async () => {
		translation.set(await loadTranslations('de', directory));
		const translate = get(lang);
		expect(translate('language')).toBe('Sprache');
		expect(translate('hearth_save')).toBe('Speichern');
		expect(translate('hearth_close')).toBe('Close');
		expect(translate('cancel')).toBe('Cancel');
		expect(translate('hearth_unknown')).toBe('hearth_unknown');
	});

	it('falls back to English for a locale without a Hearth file', async () => {
		translation.set(await loadTranslations('fr', directory));
		const translate = get(lang);
		expect(translate('language')).toBe('Langue');
		expect(translate('hearth_save')).toBe('Save');
	});

	it('refuses a locale Home Assistant does not ship', async () => {
		await expect(loadTranslations('xx', directory)).rejects.toThrow('Unknown locale xx');
		await expect(loadTranslations('../de', directory)).rejects.toThrow('Unknown locale');
		await expect(loadTranslations('hearth/de', directory)).rejects.toThrow('Unknown locale');
	});
});
