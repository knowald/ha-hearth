import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import {
	hashFile,
	hearthFile,
	homeLocales,
	pendingKeys,
	readStrings,
	serialize
} from './translations/lib.mjs';

/*
 * Prints the keys a locale still needs (missing, outdated, empty or with
 * broken placeholders) as a JSON object of key to English text. Replace each
 * value with its translation and merge the file back with
 * translations-apply.mjs.
 *
 *   node scripts/translations-missing.mjs <locale> [--out file]
 */

const { values: options, positionals } = parseArgs({
	allowPositionals: true,
	options: { out: { type: 'string' } }
});
const [locale] = positionals;
const locales = homeLocales();
if (!locale || locale === 'en' || !locales.includes(locale)) {
	console.error(
		`Usage: translations-missing.mjs <locale> [--out file]\nLocales: ${locales.filter((name) => name !== 'en').join(', ')}`
	);
	process.exit(1);
}

const english = readStrings(hearthFile('en'));
const translated = readStrings(hearthFile(locale), {});
const hashes = readStrings(hashFile(locale), {});
const failure = english.error ?? translated.error ?? hashes.error;
if (failure) {
	console.error(failure);
	process.exit(1);
}

const pending = pendingKeys(english.value, translated.value, hashes.value);
if (options.out) {
	writeFileSync(options.out, serialize(pending));
	console.error(`${Object.keys(pending).length} key(s) for ${locale} written to ${options.out}`);
} else {
	process.stdout.write(serialize(pending));
}
