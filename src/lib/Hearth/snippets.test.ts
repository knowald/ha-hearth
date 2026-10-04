import * as yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { CARD_DEFINITIONS, WIDGET_DEFINITIONS } from './model/registry';
import {
	itemDocument,
	itemFromDocument,
	pastedCards,
	pastedWidgets,
	pathLine,
	themeDocument,
	themeFileName,
	themeFromDocument
} from './snippets';
import type { OverviewCard, OverviewStack, RailWidget } from './types';

const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

// options only YAML can set, on the types that have them
const YAML_ONLY: Record<string, Record<string, unknown>> = {
	temperature: { entity: 'sensor.temperature', verdict: { good: 18, fair: 26, max: 35 } },
	entities: {
		entities: [{ entity: 'sensor.co2', verdict: { good: 800, fair: 1200 } }, { entity: 'light.a' }]
	}
};

describe('itemDocument and itemFromDocument', () => {
	it.each(CARD_DEFINITIONS.map((definition) => definition.type))(
		'round trips a %s card with every field kept',
		(type) => {
			const seed = {
				id: 'kept-id',
				type,
				fill: 2,
				visibility: [{ entity: 'input_boolean.guest', state: 'on' }],
				custom_note: 'from a newer version',
				...YAML_ONLY[type]
			};
			const first = itemFromDocument('card', yaml.dump(seed), 'kept-id');
			expect(first.issue).toBeNull();
			const card = first.value!;
			const again = itemFromDocument('card', itemDocument(card), 'kept-id');
			expect(again.issue).toBeNull();
			expect(plain(again.value)).toEqual(plain(card));
			expect(card).toMatchObject({ ...plain(seed), id: expect.any(String) });
		}
	);

	it.each(WIDGET_DEFINITIONS.map((definition) => definition.type))(
		'round trips a %s widget with every field kept',
		(type) => {
			const seed = { id: 'kept-id', type, side: 'right', custom_note: 'kept' };
			const widget = itemFromDocument('widget', yaml.dump(seed), 'kept-id').value!;
			expect(widget).toMatchObject({ type, side: 'right', custom_note: 'kept' });
			expect(plain(itemFromDocument('widget', itemDocument(widget), 'kept-id').value)).toEqual(
				plain(widget)
			);
		}
	);

	it('writes the id and type first and leaves unset keys out', () => {
		const text = itemDocument({
			type: 'iframe',
			url: 'https://example.com',
			id: 'frame',
			height: undefined
		} as unknown as OverviewCard);
		expect(text).toBe('id: frame\ntype: iframe\nurl: https://example.com\n');
	});

	it('leaves a new item without an id', () => {
		expect(itemDocument({ id: 'preview', type: 'clock' } as RailWidget, false)).toBe(
			'type: clock\n'
		);
	});

	it('reports YAML that does not parse with its line', () => {
		expect(itemFromDocument('card', 'type: entities\n entities: [\n', null).issue).toMatch(
			/^Line 2: /
		);
	});

	it('reports a schema issue with the line of the key it is about', () => {
		const text =
			'id: readings\ntype: entities\nentities:\n  - entity: sensor.co2\n    verdict: {good: 3}\n';
		expect(itemFromDocument('card', text, 'readings').issue).toBe(
			'Line 5: entities[0].verdict must be false or bands'
		);
	});

	it('keeps an existing card on its id', () => {
		expect(itemFromDocument('card', 'id: other\ntype: entities\n', 'readings').issue).toBe(
			'Line 1: id must stay readings'
		);
		expect(itemFromDocument('card', 'type: entities\n', 'readings').issue).toBeNull();
	});

	it('refuses a list, a scalar, a stack and an unknown type', () => {
		expect(itemFromDocument('card', '- type: entities\n', null).issue).toBe(
			'Expected a YAML mapping for one card'
		);
		expect(itemFromDocument('widget', 'clock', null).issue).toBe(
			'Expected a YAML mapping for one widget'
		);
		expect(itemFromDocument('card', 'kind: stack\ncards: []\n', null).issue).toBe(
			'A stack is edited from its own sheet'
		);
		expect(itemFromDocument('card', 'type: picture-glance\n', null).issue).toBe(
			'Line 1: type is not a supported card type'
		);
	});
});

describe('pastedCards', () => {
	it('gives a pasted card an id new across the dashboard', () => {
		const taken = ['entities', 'lights'];
		const result = pastedCards('id: lights\ntype: entities\ntitle: Lights\n', taken);
		expect(result.issue).toBeNull();
		expect(result.value).toEqual([
			expect.objectContaining({ id: 'entities-2', type: 'entities', title: 'Lights' })
		]);
		expect(taken).toContain('entities-2');
	});

	it('takes a list of cards and stacks, children included', () => {
		const text = `- type: entities
  entities: []
- kind: stack
  cards:
    - type: iframe
      url: https://example.com
    - type: iframe
      url: https://example.org
`;
		const result = pastedCards(text, ['iframe']);
		expect(result.issue).toBeNull();
		const [card, stack] = result.value!;
		expect(card.id).toBe('entities');
		expect(stack.id).toBe('stack');
		expect((stack as OverviewStack).cards.map((child) => child.id)).toEqual([
			'iframe-2',
			'iframe-3'
		]);
	});

	it('keeps stacks out of a stack', () => {
		expect(pastedCards('kind: stack\ncards: []\n', [], true).issue).toBe(
			'A stack cannot go inside a stack'
		);
	});

	it('accepts a Lovelace card only where it is also a Hearth card', () => {
		expect(pastedCards('type: entities\nentities:\n  - light.desk\n', []).issue).toMatch(
			/^Line 3: entities\[0\]/
		);
		expect(pastedCards('type: entities\nentities:\n  - entity: light.desk\n', []).issue).toBeNull();
	});

	it('names the list entry an issue is about', () => {
		expect(pastedCards('- type: entities\n- type: bogus\n', []).issue).toBe(
			'Line 2: [1].type is not a supported card type'
		);
	});

	it('has nothing to paste from an empty document', () => {
		expect(pastedCards('', []).issue).toBe('Nothing to paste');
		expect(pastedCards('[]', []).issue).toBe('Nothing to paste');
	});
});

describe('pastedWidgets', () => {
	it('gives each pasted widget a fresh id', () => {
		const result = pastedWidgets('- id: clock\n  type: clock\n- type: clock\n', ['clock']);
		expect(result.value?.map((widget) => widget.id)).toEqual(['clock-2', 'clock-3']);
	});

	it('refuses a widget type Hearth does not have', () => {
		expect(pastedWidgets('type: gauge\n', []).issue).toBe(
			'Line 1: type is not a supported widget type'
		);
	});
});

describe('theme sharing', () => {
	const theme = { accent: '#ff8800', background_inner: '#101010' };

	it('round trips an exported theme with its name', () => {
		expect(themeFromDocument(themeDocument('Ember', theme))).toEqual({
			value: { name: 'Ember', theme, ignored: [] },
			issue: null
		});
	});

	it('takes a bare mapping of tokens', () => {
		expect(themeFromDocument('accent: "#ff8800"\n').value).toEqual({
			theme: { accent: '#ff8800' },
			ignored: []
		});
	});

	it('refuses tokens that are not text, and an empty theme', () => {
		expect(themeFromDocument('name: Bad\ntheme:\n  accent: 12\n').issue).toBe(
			'Line 3: accent must be text'
		);
		expect(themeFromDocument('- accent\n').issue).toBe('Expected a YAML mapping of theme tokens');
		expect(themeFromDocument('name: Empty\ntheme: {}\n').issue).toBe('The theme has no tokens');
	});

	it('names the download after the theme', () => {
		expect(themeFileName('Warm Ember')).toBe('hearth-theme-warm-ember.yaml');
	});
});

describe('pathLine', () => {
	const text = `# a readings card
id: readings
type: entities
entities:
  - entity: sensor.co2
  - entity: sensor.pm25
    verdict:
      good: 3
`;

	it('finds a nested key under the list entry it belongs to', () => {
		expect(pathLine(text, ['entities', 1, 'verdict', 'good'])).toBe(8);
		expect(pathLine(text, ['entities', 1])).toBe(6);
		expect(pathLine(text, ['type'])).toBe(3);
	});

	it('falls back to the deepest part it finds', () => {
		expect(pathLine(text, ['entities', 0, 'name'])).toBe(5);
		expect(pathLine(text, ['title'])).toBeNull();
	});

	it('reads an indented document and a compact list under a key', () => {
		const indented = '    id: x\n    tiles:\n    - entity: a\n      name: b\n';
		expect(pathLine(indented, ['tiles', 0, 'name'])).toBe(4);
	});

	it('points pasted list issues at the entry', () => {
		const text = '- type: entities\n- type: entities\n  entities:\n    - entity: 3\n';
		expect(pastedCards(text, []).issue).toBe(
			'Line 4: [1].entities[0].entity must be a non-empty string'
		);
	});
});

describe('YAML the editors refuse', () => {
	const bomb = `a: &a [x, x, x, x, x, x, x, x, x]
b: &b [*a, *a, *a, *a, *a, *a, *a, *a, *a]
c: &c [*b, *b, *b, *b, *b, *b, *b, *b, *b]
d: [*c, *c, *c, *c, *c, *c, *c, *c, *c]
`;

	it('refuses aliases before they expand', () => {
		expect(pastedCards(bomb, []).issue).toMatch(
			/^Line 2: YAML aliases \(\*name\) are not supported/
		);
		expect(themeFromDocument(bomb).issue).toMatch(/aliases/);
	});

	it('refuses merge keys by name', () => {
		expect(itemFromDocument('card', 'type: entities\n<<: {title: x}\n', null).issue).toBe(
			'Line 2: YAML merge keys (<<) are not supported, write the keys out'
		);
	});

	it('writes an object reached twice out twice, without an anchor', () => {
		const shared = { entity: 'light.a' };
		const text = itemDocument({ id: 'x', type: 'entities', entities: [shared, shared] } as never);
		expect(text).not.toContain('&');
		expect(itemFromDocument('card', text, 'x').issue).toBeNull();
	});
});

describe('imported themes', () => {
	it('leaves out keys that are not tokens and lists them', () => {
		expect(themeFromDocument('accent: "#3a7d44"\nsparkle: "on"\n').value).toEqual({
			theme: { accent: '#3a7d44' },
			ignored: ['sparkle']
		});
	});

	it.each([
		['accent: "red; display: none"\n', /^Line 1: accent must be a hex colour/],
		['text_1: "#fff /*"\n', /^Line 1: text_1 must not contain comments/],
		['name: X\ntheme:\n  text_2: "red; } body { display: none"\n', /^Line 3: text_2 must not/],
		['background_image: url(//evil.example/a.png)\n', /^Line 1: background_image must be none/],
		[
			'background_image: "url(https://evil.example/a.png)"\n',
			/^Line 1: background_image must be none/
		]
	])('refuses %s', (text, issue) => {
		expect(themeFromDocument(text).issue).toMatch(issue);
	});

	it.each([
		'none',
		'url(hearth-images/abc.webp)',
		"url('/local/wall.jpg')",
		'url(data:image/png;base64,iVBORw0KGgo=)'
	])('takes the background %s', (background) => {
		expect(themeFromDocument(yaml.dump({ background_image: background })).issue).toBeNull();
	});
});
