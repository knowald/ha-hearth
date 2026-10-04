import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/*
 * Shared by check-translations.mjs, translations-missing.mjs and
 * translations-apply.mjs. Hearth's own copy lives in
 * static/translations/hearth/<locale>.json, English in en.json. The locales
 * are the Home Assistant files next to that folder, which generate.sh writes.
 *
 * For every translated key, hashes/<locale>.json records a hash of the
 * English text it was translated from. When the English text changes, the
 * hash no longer matches and the translation is reported as outdated.
 */

// the pre-commit hook points this at a copy of the staged files
const ROOT = process.env.TRANSLATIONS_ROOT
	? resolve(process.env.TRANSLATIONS_ROOT)
	: resolve(import.meta.dirname, '../..');
export const HOME_DIR = join(ROOT, 'static/translations');
export const HEARTH_DIR = join(HOME_DIR, 'hearth');
export const HASH_DIR = join(ROOT, 'scripts/translations/hashes');

// shorter English text that matches the translation is usually a word that
// reads the same in both languages, such as "OK" or "Auto"
const IDENTICAL_MIN_LENGTH = 16;

export const PREFIX = 'hearth_';

/** @typedef {Record<string, string>} Strings */
/** @typedef {{ severity: 'error' | 'warning', kind: string, key?: string, message: string }} Issue */

/** @param {string} text */
export function sourceHash(text) {
	return createHash('sha256').update(text).digest('hex').slice(0, 12);
}

/** The sorted, distinct {name} placeholders in a string. @param {string} text */
export function placeholders(text) {
	return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]))].sort();
}

/** @template T @param {Record<string, T>} object @returns {Record<string, T>} */
export function sortKeys(object) {
	return Object.fromEntries(
		Object.keys(object)
			.sort()
			.map((key) => [key, object[key]])
	);
}

/** The file text every tool writes: tabs, sorted keys, final newline. @param {object} object */
export function serialize(object) {
	return `${JSON.stringify(sortKeys(/** @type {Record<string, unknown>} */ (object)), null, '\t')}\n`;
}

/** @param {object} object */
export function isSorted(object) {
	const keys = Object.keys(object);
	return keys.every((key, index) => index === 0 || keys[index - 1] < key);
}

/**
 * Reads a JSON object; a missing file reads as `fallback` when one is given.
 * @param {string} path
 * @param {Strings} [fallback]
 * @returns {{ value: Strings, error?: string }}
 */
export function readStrings(path, fallback) {
	if (fallback && !existsSync(path)) return { value: fallback };
	try {
		const value = JSON.parse(readFileSync(path, 'utf8'));
		if (!value || typeof value !== 'object' || Array.isArray(value)) {
			return { value: {}, error: `${path} is not a JSON object` };
		}
		return { value };
	} catch (error) {
		return { value: {}, error: `${path}: ${error instanceof Error ? error.message : error}` };
	}
}

/** The locales Home Assistant ships, from the generated files. */
export function homeLocales(dir = HOME_DIR) {
	return readdirSync(dir, { withFileTypes: true })
		.filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
		.map((entry) => entry.name.slice(0, -'.json'.length))
		.sort();
}

/** The locale names of the .json files in a folder. @param {string} dir */
export function jsonFiles(dir) {
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((name) => name.endsWith('.json'))
		.map((name) => name.slice(0, -'.json'.length))
		.sort();
}

export const hearthFile = (/** @type {string} */ locale) => join(HEARTH_DIR, `${locale}.json`);
export const hashFile = (/** @type {string} */ locale) => join(HASH_DIR, `${locale}.json`);

/**
 * A value the object holds itself; inherited names such as `constructor`
 * read as absent.
 * @param {Strings} object @param {string} key
 */
const own = (object, key) => (Object.hasOwn(object, key) ? object[key] : undefined);

/**
 * Whether a translated key needs (re)translating, and why.
 * @param {string} source the English text
 * @param {string | undefined} translated
 * @param {string | undefined} hash
 * @returns {'missing' | 'empty' | 'outdated' | 'placeholders' | null}
 */
export function keyState(source, translated, hash) {
	if (translated === undefined) return 'missing';
	if (typeof translated !== 'string' || translated.trim() === '') return 'empty';
	if (placeholders(source).join() !== placeholders(translated).join()) return 'placeholders';
	if (hash !== sourceHash(source)) return 'outdated';
	return null;
}

/**
 * Everything wrong with one locale's Hearth file against English.
 * `warnOnly` reports missing and outdated translations as warnings, so the
 * check can run before a locale is translated at all.
 * @param {{ english: Strings, translated: Strings, hashes: Strings, warnOnly?: boolean }} input
 * @returns {Issue[]}
 */
export function checkLocale({ english, translated, hashes, warnOnly = false }) {
	/** @type {Issue[]} */
	const issues = [];
	const debt = warnOnly ? 'warning' : 'error';
	for (const [key, source] of Object.entries(english)) {
		const value = own(translated, key);
		const state = keyState(source, value, own(hashes, key));
		if (state === 'missing') {
			issues.push({ severity: debt, kind: 'missing', key, message: 'not translated' });
		} else if (state === 'empty') {
			issues.push({ severity: 'error', kind: 'empty', key, message: 'empty value' });
		} else if (state === 'placeholders') {
			issues.push({
				severity: 'error',
				kind: 'placeholders',
				key,
				message: `placeholders {${placeholders(value).join('}, {')}} differ from English {${placeholders(source).join('}, {')}}`
			});
		} else if (state === 'outdated') {
			issues.push({
				severity: debt,
				kind: 'outdated',
				key,
				message:
					own(hashes, key) === undefined
						? 'no source hash recorded, apply it with translations-apply'
						: 'English text changed since it was translated'
			});
		}
		if (state !== 'missing' && value === source && source.length >= IDENTICAL_MIN_LENGTH) {
			issues.push({ severity: 'warning', kind: 'identical', key, message: 'same as English' });
		}
	}
	for (const key of Object.keys(translated)) {
		if (!Object.hasOwn(english, key)) {
			issues.push({ severity: 'error', kind: 'extra', key, message: 'not in English' });
		}
	}
	for (const key of Object.keys(hashes)) {
		if (!Object.hasOwn(translated, key)) {
			issues.push({
				severity: 'error',
				kind: 'stale-hash',
				key,
				message: 'hash of a key that is not translated'
			});
		}
	}
	if (!isSorted(translated)) {
		issues.push({ severity: 'error', kind: 'unsorted', message: 'keys are not sorted' });
	}
	if (!isSorted(hashes)) {
		issues.push({ severity: 'error', kind: 'unsorted', message: 'hash keys are not sorted' });
	}
	return issues;
}

/**
 * English, checked on its own: no empty values, sorted, every key prefixed
 * hearth_ so it can never collide with a generated Home Assistant key, and
 * none the generated file already has, since the Hearth one would hide it.
 * @param {Strings} english
 * @param {Strings} home
 * @returns {Issue[]}
 */
export function checkEnglish(english, home) {
	/** @type {Issue[]} */
	const issues = [];
	for (const [key, value] of Object.entries(english)) {
		if (typeof value !== 'string' || value.trim() === '') {
			issues.push({ severity: 'error', kind: 'empty', key, message: 'empty value' });
		}
		if (!key.startsWith(PREFIX)) {
			issues.push({
				severity: 'error',
				kind: 'prefix',
				key,
				message: `Hearth keys start with ${PREFIX}`
			});
		}
		if (Object.hasOwn(home, key)) {
			issues.push({
				severity: 'error',
				kind: 'duplicate',
				key,
				message: 'also in the generated en.json'
			});
		}
	}
	if (!isSorted(english)) {
		issues.push({ severity: 'error', kind: 'unsorted', message: 'keys are not sorted' });
	}
	return issues;
}

/**
 * The keys a locale still needs, with the English text to translate.
 * @param {Strings} english @param {Strings} translated @param {Strings} hashes
 * @returns {Strings}
 */
export function pendingKeys(english, translated, hashes) {
	return sortKeys(
		Object.fromEntries(
			Object.entries(english).filter(
				([key, source]) => keyState(source, own(translated, key), own(hashes, key)) !== null
			)
		)
	);
}

/**
 * Merges filled-in translations into a locale and records the English each
 * one was made from. Nothing is merged when any entry is unusable. A value
 * identical to English is usually an untranslated leftover, so it counts as
 * unusable unless `allowIdentical` says the words really are the same.
 * @param {{ english: Strings, translated: Strings, hashes: Strings, filled: Record<string, unknown>, allowIdentical?: boolean }} input
 * @returns {{ translated: Strings, hashes: Strings, errors: string[], identical: string[] }}
 */
export function applyTranslations({ english, translated, hashes, filled, allowIdentical = false }) {
	const errors = [];
	const identical = [];
	for (const [key, value] of Object.entries(filled)) {
		if (!Object.hasOwn(english, key)) errors.push(`${key}: not in English`);
		else if (typeof value !== 'string' || value.trim() === '') errors.push(`${key}: empty value`);
		else if (value === english[key]) {
			identical.push(key);
			if (!allowIdentical) errors.push(`${key}: same as English`);
		} else if (placeholders(value).join() !== placeholders(english[key]).join()) {
			errors.push(
				`${key}: placeholders {${placeholders(value).join('}, {')}} differ from English {${placeholders(english[key]).join('}, {')}}`
			);
		}
	}
	if (errors.length) return { translated, hashes, errors, identical };
	const nextTranslated = { ...translated };
	const nextHashes = { ...hashes };
	for (const [key, value] of Object.entries(filled)) {
		nextTranslated[key] = /** @type {string} */ (value);
		nextHashes[key] = sourceHash(english[key]);
	}
	return {
		translated: sortKeys(nextTranslated),
		hashes: sortKeys(nextHashes),
		errors,
		identical
	};
}

/**
 * Drops keys English no longer has and hashes of keys that are not
 * translated, and names what it dropped.
 * @param {Strings} english @param {Strings} translated @param {Strings} hashes
 */
export function prune(english, translated, hashes) {
	const kept = Object.fromEntries(
		Object.entries(translated).filter(([key]) => Object.hasOwn(english, key))
	);
	return {
		translated: kept,
		hashes: Object.fromEntries(Object.entries(hashes).filter(([key]) => Object.hasOwn(kept, key))),
		dropped: Object.keys(translated).filter((key) => !Object.hasOwn(kept, key)),
		droppedHashes: Object.keys(hashes).filter((key) => !Object.hasOwn(kept, key))
	};
}

/**
 * Writes a locale's hashes; a locale with nothing translated gets no file.
 * @param {string} locale @param {Strings} hashes
 */
export function writeHashes(locale, hashes) {
	if (!Object.keys(hashes).length && !existsSync(hashFile(locale))) return;
	mkdirSync(HASH_DIR, { recursive: true });
	writeFileSync(hashFile(locale), serialize(hashes));
}
