import { describe, expect, it } from 'vitest';
import { hearthConfigIssues, normalizeHearthConfig } from '../../normalize';
import { templateCard } from './template';

function page(card: Record<string, unknown>) {
	return { rail: [], rooms: [{ id: 'home', name: 'Home', cards: [[{ id: 'note', ...card }]] }] };
}

describe('template card', () => {
	it('keeps the template verbatim and trims the rest', () => {
		const config = normalizeHearthConfig(
			page({
				type: 'template',
				content: "  **{{ states('sensor.a') }}**\n",
				title: ' Note ',
				icon: ' thermostat ',
				entities: [' sensor.a ', '', 7, 'sensor.b']
			})
		);
		expect(config.rooms[0].cards[0][0]).toMatchObject({
			type: 'template',
			content: "  **{{ states('sensor.a') }}**\n",
			title: 'Note',
			icon: 'thermostat',
			entities: ['sensor.a', 'sensor.b']
		});
	});

	it('needs a template and reports its entity hints', () => {
		const empty = templateCard.normalize({ content: '  ' });
		expect(empty.content).toBeUndefined();
		expect(templateCard.needsConfiguration({ id: 'x', type: 'template' })).toBe(true);
		expect(templateCard.needsConfiguration({ id: 'x', type: 'template', content: '{{ 1 }}' })).toBe(
			false
		);
		expect(
			templateCard.entityIds({ id: 'x', type: 'template', content: 'x', entities: ['sensor.a'] })
		).toEqual(['sensor.a']);
		expect(templateCard.entityIds({ id: 'x', type: 'template', content: 'x' })).toEqual([]);
	});

	it('names the fields a YAML edit got wrong', () => {
		expect(hearthConfigIssues(page({ type: 'template', content: '{{ 1 }}' }))).toEqual([]);
		const issues = hearthConfigIssues(
			page({ type: 'template', content: 5, title: ['x'], entities: 'sensor.a' })
		);
		expect(issues).toContain('rooms[0].cards[0][0].content must be text');
		expect(issues).toContain('rooms[0].cards[0][0].title must be text');
		expect(issues.some((issue) => issue.startsWith('rooms[0].cards[0][0].entities'))).toBe(true);
	});

	it('validates tile templates on entity refs', () => {
		const card = (ref: Record<string, unknown>) =>
			page({ type: 'entities', entities: [{ entity: 'switch.fan', ...ref }] });
		expect(hearthConfigIssues(card({ name_template: '{{ 1 }}', state_template: 'x' }))).toEqual([]);
		expect(hearthConfigIssues(card({ state_template: 3 }))).toContain(
			'rooms[0].cards[0][0].entities[0].state_template must be text'
		);
	});
});
