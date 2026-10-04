import { writeFileSync } from 'node:fs';
import {
	applyTranslations,
	hashFile,
	hearthFile,
	homeLocales,
	readStrings,
	serialize,
	writeHashes
} from './translations/lib.mjs';

/*
 * Merges a JSON object of key to translated text, usually a filled-in
 * translations-missing.mjs file, into a locale and records which English
 * text each translation was made from. Every entry must be a key English
 * has, with a non-empty value and the same {placeholders}; otherwise nothing
 * is written.
 *
 *   node scripts/translations-apply.mjs <locale> <file>
 */

const [locale, file] = process.argv.slice(2);
const locales = homeLocales();
if (!locale || !file || locale === 'en' || !locales.includes(locale)) {
	console.error(
		`Usage: translations-apply.mjs <locale> <file>\nLocales: ${locales.filter((name) => name !== 'en').join(', ')}`
	);
	process.exit(1);
}

const english = readStrings(hearthFile('en'));
const translated = readStrings(hearthFile(locale), {});
const hashes = readStrings(hashFile(locale), {});
const filled = readStrings(file);
const failure = english.error ?? translated.error ?? hashes.error ?? filled.error;
if (failure) {
	console.error(failure);
	process.exit(1);
}

const result = applyTranslations({
	english: english.value,
	translated: translated.value,
	hashes: hashes.value,
	filled: filled.value
});
if (result.errors.length) {
	console.error(`Nothing applied to ${locale}:`);
	for (const error of result.errors) console.error(`  ${error}`);
	process.exit(1);
}

writeFileSync(hearthFile(locale), serialize(result.translated));
writeHashes(locale, result.hashes);
const total = Object.keys(english.value).length;
const done = Object.keys(result.translated).length;
console.log(`Applied ${Object.keys(filled.value).length} key(s) to ${locale} (${done}/${total}).`);
