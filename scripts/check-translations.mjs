import { existsSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import {
	HASH_DIR,
	HEARTH_DIR,
	HOME_DIR,
	checkEnglish,
	checkLocale,
	hashFile,
	hearthFile,
	homeLocales,
	jsonFiles,
	readStrings,
	serialize,
	prune,
	sortKeys,
	writeHashes
} from './translations/lib.mjs';

/*
 * Checks Hearth's own translations (static/translations/hearth/) against
 * English: missing, outdated, extra and empty keys, {placeholder} parity and
 * key order. See docs/development.md#translations.
 *
 *   --locale xx  check one locale and list every issue
 *   --warn-only  report missing and outdated translations and missing locale
 *                files without failing
 *   --fix        sort keys and create missing locale files
 *   --prune      with --fix, also drop keys English no longer has, naming each
 */

const { values: options } = parseArgs({
	options: {
		locale: { type: 'string' },
		'warn-only': { type: 'boolean', default: false },
		fix: { type: 'boolean', default: false },
		prune: { type: 'boolean', default: false }
	}
});
if (options.prune && !options.fix) {
	console.error('--prune only works together with --fix');
	process.exit(1);
}

// a full run lists the first few errors of each kind and counts warnings;
// --locale lists everything
const LISTED = 5;

const locales = homeLocales();
if (options.locale && !locales.includes(options.locale)) {
	console.error(`Unknown locale ${options.locale}. Known: ${locales.join(', ')}`);
	process.exit(1);
}

let errors = 0;
let warnings = 0;

/** @param {string} name @param {import('./translations/lib.mjs').Issue[]} issues */
function report(name, issues) {
	if (!issues.length) return;
	errors += issues.filter((issue) => issue.severity === 'error').length;
	warnings += issues.filter((issue) => issue.severity === 'warning').length;
	/** @type {Map<string, import('./translations/lib.mjs').Issue[]>} */
	const groups = new Map();
	for (const issue of issues) {
		const group = `${issue.kind} (${issue.severity})`;
		groups.set(group, [...(groups.get(group) ?? []), issue]);
	}
	console.log(
		`${name}: ${[...groups].map(([group, grouped]) => `${grouped.length} ${group}`).join(', ')}`
	);
	for (const grouped of groups.values()) {
		const listed = options.locale
			? grouped
			: grouped[0].severity === 'error'
				? grouped.slice(0, LISTED)
				: [];
		for (const issue of listed) {
			console.log(`    ${issue.key ? `${issue.key}: ` : ''}${issue.message}`);
		}
		if (listed.length && listed.length < grouped.length) {
			console.log(`    ... and ${grouped.length - listed.length} more`);
		}
	}
}

const home = readStrings(`${HOME_DIR}/en.json`);
const english = readStrings(hearthFile('en'));
if (home.error || english.error) {
	report('en', [
		{ severity: 'error', kind: 'invalid', message: String(home.error ?? english.error) }
	]);
	process.exit(1);
}
if (options.fix) writeFileSync(hearthFile('en'), serialize(english.value));
const englishStrings = options.fix ? sortKeys(english.value) : english.value;
if (!options.locale) report('en', checkEnglish(englishStrings, home.value));

// every Home Assistant locale has a Hearth file, and nothing else does
if (!options.locale) {
	const files = [];
	for (const locale of jsonFiles(HEARTH_DIR).filter((name) => !locales.includes(name))) {
		files.push({
			severity: /** @type {const} */ ('error'),
			kind: 'orphan',
			message: `hearth/${locale}.json has no Home Assistant locale file`
		});
	}
	for (const locale of jsonFiles(HASH_DIR).filter((name) => !locales.includes(name))) {
		files.push({
			severity: /** @type {const} */ ('error'),
			kind: 'orphan',
			message: `hashes/${locale}.json has no Home Assistant locale file`
		});
	}
	report('files', files);
}

for (const locale of options.locale ? [options.locale] : locales) {
	if (locale === 'en') continue;
	const path = hearthFile(locale);
	if (!existsSync(path)) {
		if (options.fix) {
			writeFileSync(path, serialize({}));
		} else {
			report(locale, [
				{
					severity: options['warn-only'] ? 'warning' : 'error',
					kind: 'no-file',
					message: `hearth/${locale}.json is missing, run with --fix to create it`
				}
			]);
			continue;
		}
	}
	const translated = readStrings(path);
	const hashes = readStrings(hashFile(locale), {});
	if (translated.error || hashes.error) {
		report(locale, [
			{ severity: 'error', kind: 'invalid', message: String(translated.error ?? hashes.error) }
		]);
		continue;
	}
	let files = { translated: translated.value, hashes: hashes.value };
	if (options.prune) {
		const pruned = prune(englishStrings, files.translated, files.hashes);
		for (const key of pruned.dropped) console.log(`${locale}: dropped ${key}`);
		for (const key of pruned.droppedHashes) console.log(`${locale}: dropped hash of ${key}`);
		files = pruned;
	}
	if (options.fix) {
		files = { translated: sortKeys(files.translated), hashes: sortKeys(files.hashes) };
		writeFileSync(path, serialize(files.translated));
		writeHashes(locale, files.hashes);
	}
	report(
		locale,
		checkLocale({
			english: englishStrings,
			translated: files.translated,
			hashes: files.hashes,
			warnOnly: options['warn-only']
		})
	);
}

console.log(`Translation check: ${errors} error(s), ${warnings} warning(s).`);
if (errors) {
	console.log(
		'Fill a locale with `just translations-missing <locale>` and `just translations-apply`.'
	);
	process.exitCode = 1;
}
