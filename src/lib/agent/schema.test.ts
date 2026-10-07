// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import Ajv from 'ajv';
import * as yaml from 'js-yaml';
import { hearthConfigIssues } from '$lib/Hearth/normalize';
import { CARD_DEFINITIONS } from '$lib/Hearth/model/registry';
import { hearthJsonSchema, outlineJsonSchema, typeJsonSchema } from './schema';

const validate = new Ajv({ allErrors: true, strict: false }).compile(hearthJsonSchema());

function fixture(path: string) {
	return yaml.load(readFileSync(path, 'utf8')) as Record<string, any>;
}

describe('hearthJsonSchema', () => {
	it.each(['e2e/fixture/data/hearth.yaml', 'e2e/fixture-matrix/data/hearth.yaml'])(
		'accepts the valid document %s',
		(path) => {
			const document = fixture(path);
			expect(hearthConfigIssues(document)).toEqual([]);
			expect(validate(document), JSON.stringify(validate.errors)).toBe(true);
		}
	);

	it('refuses an unknown card type, a missing id and a wrong version', () => {
		const document = fixture('e2e/fixture/data/hearth.yaml');
		document.version = 4;
		document.rooms[0].cards[0].push({ id: 'x', type: 'no_such_card' });
		delete document.rail[0].id;
		expect(validate(document)).toBe(false);
		const paths = validate.errors!.map(({ instancePath }) => instancePath);
		expect(paths).toContain('/version');
		expect(paths).toContain('/rail/0');
		expect(paths.some((path) => path.startsWith('/rooms/0/cards/0/'))).toBe(true);
	});

	it('checks a card against the fields of its own type', () => {
		const document = fixture('e2e/fixture/data/hearth.yaml');
		document.rooms[0].cards[0].push({ id: 'scenes-x', type: 'scenes', style: 'wavy' });
		expect(validate(document)).toBe(false);
		expect(validate.errors!.some(({ instancePath }) => instancePath.endsWith('/style'))).toBe(true);
	});
});

describe('outlineJsonSchema and typeJsonSchema', () => {
	it('leaves the per-type fields out of the outline and serves them one type at a time', () => {
		const outline = JSON.stringify(outlineJsonSchema());
		expect(outline.length).toBeLessThan(JSON.stringify(hearthJsonSchema()).length / 2);
		expect(outline).toContain('"scenes"');
		const scenes = typeJsonSchema('card', 'scenes')!;
		expect(Object.keys(scenes.properties ?? {})).toEqual(
			expect.arrayContaining(['title', 'style', 'scenes'])
		);
		expect(typeJsonSchema('card', 'no_such_card')).toBeUndefined();
	});

	it('brings along the shared definitions a type refers to', () => {
		const all = [...CARD_DEFINITIONS.map(({ type }) => typeJsonSchema('card', type)!)];
		for (const schema of all) {
			const refs = JSON.stringify(schema).match(/#\/definitions\/[\w]+/g) ?? [];
			for (const ref of refs) {
				expect(schema.definitions).toHaveProperty(ref.slice('#/definitions/'.length));
			}
		}
	});
});
