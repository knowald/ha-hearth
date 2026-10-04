// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
	applyTranslations,
	checkEnglish,
	checkLocale,
	pendingKeys,
	placeholders,
	serialize,
	sourceHash,
	prune
} from './lib.mjs';

const english = {
	hearth_greeting: 'Hello {name}, you have {count} alerts',
	hearth_ok: 'OK',
	hearth_save: 'Save'
};

/** hashes for a locale translated from the current English */
const hashed = (keys: (keyof typeof english)[]) =>
	Object.fromEntries(keys.map((key) => [key, sourceHash(english[key])]));

const kinds = (issues: { kind: string; key?: string; severity: string }[]) =>
	issues.map((issue) => `${issue.severity} ${issue.kind} ${issue.key ?? ''}`.trim());

describe('placeholders', () => {
	it('lists each placeholder once, sorted', () => {
		expect(placeholders('{b} and {a} then {b}')).toEqual(['a', 'b']);
		expect(placeholders('none here')).toEqual([]);
	});
});

describe('checkLocale', () => {
	it('passes a complete, current translation', () => {
		const translated = {
			hearth_greeting: 'Hallo {name}, du hast {count} Meldungen',
			hearth_ok: 'OK',
			hearth_save: 'Speichern'
		};
		const issues = checkLocale({ english, translated, hashes: hashed(Object.keys(english) as []) });
		expect(issues).toEqual([]);
	});

	it('reports missing keys as errors, or warnings with warnOnly', () => {
		const input = { english, translated: {}, hashes: {} };
		expect(kinds(checkLocale(input))).toEqual([
			'error missing hearth_greeting',
			'error missing hearth_ok',
			'error missing hearth_save'
		]);
		expect(kinds(checkLocale({ ...input, warnOnly: true }))).toEqual([
			'warning missing hearth_greeting',
			'warning missing hearth_ok',
			'warning missing hearth_save'
		]);
	});

	it('reports placeholders that differ from English, even with warnOnly', () => {
		const issues = checkLocale({
			english: { hearth_greeting: english.hearth_greeting },
			translated: { hearth_greeting: 'Hallo {nom}, {count} Meldungen' },
			hashes: hashed(['hearth_greeting']),
			warnOnly: true
		});
		expect(kinds(issues)).toEqual(['error placeholders hearth_greeting']);
		expect(issues[0].message).toContain('{nom}');
	});

	it('reports extra keys, empty values and unsorted files', () => {
		const issues = checkLocale({
			english: { hearth_ok: 'OK', hearth_save: 'Save' },
			translated: { hearth_save: '', hearth_ok: 'OK', hearth_gone: 'Weg' },
			hashes: { hearth_ok: sourceHash('OK'), hearth_save: sourceHash('Save') }
		});
		expect(kinds(issues)).toEqual([
			'error empty hearth_save',
			'error extra hearth_gone',
			'error unsorted'
		]);
	});

	it('reports a translation as outdated once its English text changes', () => {
		const translated = { hearth_save: 'Speichern' };
		const hashes = { hearth_save: sourceHash('Save') };
		expect(checkLocale({ english: { hearth_save: 'Save' }, translated, hashes })).toEqual([]);
		const changed = checkLocale({ english: { hearth_save: 'Save changes' }, translated, hashes });
		expect(kinds(changed)).toEqual(['error outdated hearth_save']);
		expect(changed[0].message).toBe('English text changed since it was translated');
	});

	it('treats a translation without a recorded hash as outdated', () => {
		const issues = checkLocale({
			english: { hearth_save: 'Save' },
			translated: { hearth_save: 'Speichern' },
			hashes: {}
		});
		expect(kinds(issues)).toEqual(['error outdated hearth_save']);
	});

	it('reports hashes of keys that are not translated', () => {
		const issues = checkLocale({
			english: { hearth_save: 'Save' },
			translated: {},
			hashes: { hearth_save: sourceHash('Save') },
			warnOnly: true
		});
		expect(kinds(issues)).toEqual(['warning missing hearth_save', 'error stale-hash hearth_save']);
	});

	it('warns about long text left in English but not about short words', () => {
		const long = 'Keep the screen awake while charging';
		const issues = checkLocale({
			english: { hearth_long: long, hearth_ok: 'OK' },
			translated: { hearth_long: long, hearth_ok: 'OK' },
			hashes: { hearth_long: sourceHash(long), hearth_ok: sourceHash('OK') }
		});
		expect(kinds(issues)).toEqual(['warning identical hearth_long']);
	});
	it('reads inherited names such as constructor as absent', () => {
		const issues = checkLocale({
			english: { constructor: 'Builder', toString: 'Text' },
			translated: {},
			hashes: {}
		});
		expect(kinds(issues)).toEqual(['error missing constructor', 'error missing toString']);
	});
});

describe('checkEnglish', () => {
	it('reports empty values, unprefixed keys, keys the generated file has and unsorted keys', () => {
		const issues = checkEnglish(
			{ hearth_b: '', delete: 'Delete', hearth_a: 'A', hearth_close: 'Close' },
			{ delete: 'x', hearth_close: 'Close' }
		);
		expect(kinds(issues)).toEqual([
			'error empty hearth_b',
			'error prefix delete',
			'error duplicate delete',
			'error duplicate hearth_close',
			'error unsorted'
		]);
	});

	it('does not take inherited names for keys of the generated file', () => {
		expect(checkEnglish({ hearth_a: 'A' }, {})).toEqual([]);
		expect(kinds(checkEnglish({ toString: 'Text' }, {}))).toEqual(['error prefix toString']);
	});
});

describe('pendingKeys', () => {
	it('lists missing, outdated and broken keys with their English text', () => {
		const pending = pendingKeys(
			english,
			{ hearth_greeting: 'Hallo {name}', hearth_ok: 'OK', hearth_save: 'Sichern' },
			{ ...hashed(['hearth_greeting', 'hearth_ok']), hearth_save: sourceHash('Store') }
		);
		expect(pending).toEqual({
			hearth_greeting: english.hearth_greeting,
			hearth_save: english.hearth_save
		});
	});
});

describe('applyTranslations', () => {
	it('merges filled keys sorted and records the English they came from', () => {
		const result = applyTranslations({
			english,
			translated: { hearth_save: 'Speichern' },
			hashes: hashed(['hearth_save']),
			filled: { hearth_greeting: 'Hallo {name}, {count} Meldungen' }
		});
		expect(result.errors).toEqual([]);
		expect(Object.keys(result.translated)).toEqual(['hearth_greeting', 'hearth_save']);
		expect(result.hashes).toEqual(hashed(['hearth_greeting', 'hearth_save']));
		expect(
			checkLocale({
				english: { hearth_greeting: english.hearth_greeting, hearth_save: english.hearth_save },
				translated: result.translated,
				hashes: result.hashes
			})
		).toEqual([]);
	});

	it('applies nothing when any entry is unusable', () => {
		const translated = { hearth_save: 'Speichern' };
		const result = applyTranslations({
			english,
			translated,
			hashes: {},
			filled: {
				hearth_greeting: 'Hallo {name}',
				hearth_new: 'Neu',
				hearth_save: ' ',
				constructor: 'Bauer'
			}
		});
		expect(result.translated).toBe(translated);
		expect(result.errors).toEqual([
			'hearth_greeting: placeholders {name} differ from English {count}, {name}',
			'hearth_new: not in English',
			'hearth_save: empty value',
			'constructor: not in English'
		]);
	});

	it('refuses text identical to English unless told it is right', () => {
		const input = { english, translated: {}, hashes: {}, filled: { hearth_ok: 'OK' } };
		const refused = applyTranslations(input);
		expect(refused.errors).toEqual(['hearth_ok: same as English']);
		expect(refused.identical).toEqual(['hearth_ok']);
		const allowed = applyTranslations({ ...input, allowIdentical: true });
		expect(allowed.errors).toEqual([]);
		expect(allowed.identical).toEqual(['hearth_ok']);
		expect(allowed.translated).toEqual({ hearth_ok: 'OK' });
		expect(allowed.hashes).toEqual(hashed(['hearth_ok']));
	});
});

describe('prune', () => {
	it('drops keys English no longer has and their hashes, naming each', () => {
		const result = prune(
			{ hearth_a: 'A', hearth_b: 'B' },
			{ hearth_b: 'B2', hearth_gone: 'X', hearth_a: 'A2' },
			{ hearth_gone: '1', hearth_b: '2', hearth_c: '3' }
		);
		expect(result.translated).toEqual({ hearth_b: 'B2', hearth_a: 'A2' });
		expect(result.hashes).toEqual({ hearth_b: '2' });
		expect(result.dropped).toEqual(['hearth_gone']);
		expect(result.droppedHashes).toEqual(['hearth_gone', 'hearth_c']);
	});
});

describe('serialize', () => {
	it('writes sorted keys, tabs and a final newline', () => {
		expect(serialize({ hearth_b: 'B', hearth_a: 'A' })).toBe(
			'{\n\t"hearth_a": "A",\n\t"hearth_b": "B"\n}\n'
		);
	});
});
