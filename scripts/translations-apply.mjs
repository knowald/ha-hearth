import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
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
 * has, with a non-empty value, the same {placeholders} and text that differs
 * from English; otherwise nothing is written. Pass --allow-identical when
 * some words really read the same in both languages.
 *
 *   node scripts/translations-apply.mjs <locale> <file> [--allow-identical]
 */

const { values: options, positionals } = parseArgs({
	allowPositionals: true,
	options: { 'allow-identical': { type: 'boolean', default: false } }
});
const [locale, file] = positionals;
const locales = homeLocales();
if (!locale || !file || locale === 'en' || !locales.includes(locale)) {
	console.error(
		`Usage: translations-apply.mjs <locale> <file> [--allow-identical]\nLocales: ${locales.filter((name) => name !== 'en').join(', ')}`
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
	filled: filled.value,
	allowIdentical: options['allow-identical']
});
if (result.errors.length) {
	console.error(`Nothing applied to ${locale}, ${result.errors.length} entry(s) refused:`);
	for (const error of result.errors) console.error(`  ${error}`);
	if (result.identical.length && !options['allow-identical']) {
		console.error(
			`${result.identical.length} value(s) are the same as English. Translate them, or rerun with --allow-identical if they are right.`
		);
	}
	process.exit(1);
}

writeFileSync(hearthFile(locale), serialize(result.translated));
writeHashes(locale, result.hashes);
const englishKeys = Object.keys(english.value);
const done = englishKeys.filter((key) => Object.hasOwn(result.translated, key)).length;
console.log(
	`Applied ${Object.keys(filled.value).length} key(s) to ${locale}, ${result.identical.length} same as English; ${done}/${englishKeys.length} translated.`
);
