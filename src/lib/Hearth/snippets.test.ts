import * as yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { CARD_DEFINITIONS, WIDGET_DEFINITIONS } from './model/registry';
import {
	itemDocument,
	itemFromDocument,
	pastedCards,
	pastedWidgets,
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
			'Line 3: entities[0].verdict must be false or bands'
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
			/^Line 2: entities\[0\]/
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
			value: { name: 'Ember', theme },
			issue: null
		});
	});

	it('takes a bare mapping of tokens', () => {
		expect(themeFromDocument('accent: "#ff8800"\n').value).toEqual({
			theme: { accent: '#ff8800' }
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
