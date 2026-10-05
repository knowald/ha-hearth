import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { english as en } from '$lib/core/i18n/testing';
import CodeField from './CodeField.svelte';
import FormRenderer from './FormRenderer.svelte';
import { EditorForm, type EditorField } from './form.svelte';

type Item = {
	title?: string;
	entity?: string;
	url?: string;
	style?: string;
	math?: string;
	stroke?: number;
	summary?: string;
	collapsed?: boolean;
	extra?: string;
};

const FIELDS: EditorField<Item>[] = [
	{ key: 'title', kind: 'text', label: 'hearth_title', hint: 'hearth_math_hint' },
	{ key: 'entity', kind: 'entity', required: true },
	{
		key: 'style',
		kind: 'select',
		label: 'hearth_chart_style',
		default: 'line',
		options: [
			{ value: 'line', label: 'hearth_chart_line' },
			{ value: 'bar', label: 'hearth_chart_bar' }
		]
	},
	{
		key: 'math',
		kind: 'text',
		label: 'hearth_math',
		advanced: true,
		show: (values) => values.style === 'line'
	},
	{
		key: 'stroke',
		kind: 'number',
		label: 'hearth_stroke_width',
		integer: true,
		min: 1,
		advanced: true
	},
	{ key: 'collapsed', kind: 'check', label: 'hearth_divider_line' },
	{
		key: 'summary',
		kind: 'text',
		label: 'hearth_summary_text_optional',
		show: (values) => values.collapsed === true,
		clearHidden: true
	}
];

function setup(item?: Item, fields = FIELDS) {
	const onchange = vi.fn();
	const form = new EditorForm(item, fields);
	render(FormRenderer, { form: form as EditorForm<unknown>, onchange });
	return { form, last: () => onchange.mock.lastCall?.[0] };
}

const required = (label: string) => en.hearth_field_required.replace('{field}', label);

describe('FormRenderer', () => {
	it('reports trimmed text, and blank text as absent', async () => {
		const { last } = setup({ entity: 'light.desk' });
		await fireEvent.input(screen.getByLabelText(en.hearth_title), {
			target: { value: '  Kitchen  ' }
		});
		expect(last().fields.title).toBe('Kitchen');
		await fireEvent.input(screen.getByLabelText(en.hearth_title), { target: { value: '   ' } });
		expect(last().fields.title).toBeUndefined();
	});

	it('blocks Done while a required field is blank, naming it', async () => {
		const { last } = setup();
		expect(last()).toMatchObject({ valid: false, reason: required(en.entity) });
		await fireEvent.input(screen.getByLabelText(en.entity), { target: { value: 'light.desk' } });
		expect(last()).toMatchObject({ valid: true, fields: { entity: 'light.desk' } });
	});

	it('uses a custom reason and a short label for the reason', () => {
		const { last } = setup(undefined, [
			{ key: 'entity', kind: 'entity', required: true, reason: 'hearth_calendar_entities_required' }
		]);
		expect(last().reason).toBe(en.hearth_calendar_entities_required);
		const short = setup(undefined, [
			{
				key: 'entity',
				kind: 'entity',
				label: 'hearth_energy_sensor_today_total_or_increasing',
				shortLabel: 'hearth_energy_sensor',
				required: true
			}
		]);
		expect(short.last().reason).toBe(required(en.hearth_energy_sensor));
	});

	it('shows an invalid value under its field and gives the generic reason', () => {
		const { last } = setup({ url: 'not a url' }, [
			{
				key: 'url',
				kind: 'text',
				label: 'hearth_url',
				required: true,
				write: (raw) => (String(raw).startsWith('https://') ? String(raw) : undefined),
				invalid: 'hearth_embed_url_hint'
			}
		]);
		expect(last().valid).toBe(false);
		expect(last().reason).toBeUndefined();
		const alert = screen.getByRole('alert');
		expect(alert.textContent).toBe(en.hearth_embed_url_hint);
		expect(screen.getByLabelText(en.hearth_url).getAttribute('aria-describedby')).toBe(alert.id);
	});

	it('stores a select at its default as absent', async () => {
		const { last } = setup({ style: 'bar' });
		expect(last().fields.style).toBe('bar');
		await fireEvent.change(screen.getByLabelText(en.hearth_chart_style), {
			target: { value: 'line' }
		});
		expect(last().fields.style).toBeUndefined();
	});

	it('keeps advanced fields behind a closed disclosure until opened', async () => {
		setup();
		const toggle = screen.getByRole('button', { name: en.hearth_advanced });
		expect(toggle.getAttribute('aria-expanded')).toBe('false');
		expect(screen.queryByLabelText(en.hearth_stroke_width)).toBeNull();
		await fireEvent.click(toggle);
		expect(toggle.getAttribute('aria-expanded')).toBe('true');
		expect(screen.getByLabelText(en.hearth_stroke_width)).toBeTruthy();
	});

	it('opens the disclosure when an advanced field holds a value', async () => {
		const { last } = setup({ stroke: 3 });
		expect(
			screen.getByRole('button', { name: en.hearth_advanced }).getAttribute('aria-expanded')
		).toBe('true');
		expect(last().fields.stroke).toBe(3);
		await fireEvent.input(screen.getByLabelText(en.hearth_stroke_width), {
			target: { value: '0' }
		});
		expect(last().fields.stroke).toBeUndefined();
	});

	it('hides fields by their show condition, keeping or clearing their value', async () => {
		const { last } = setup({ stroke: 2, math: 'x / 2', style: 'bar', summary: 'Lights' });
		expect(screen.queryByLabelText(en.hearth_math)).toBeNull();
		// a hidden field keeps what was typed unless it clears itself
		expect(last().fields.math).toBe('x / 2');
		expect(screen.queryByLabelText(en.hearth_summary_text_optional)).toBeNull();
		expect(last().fields.summary).toBeUndefined();
		await fireEvent.click(screen.getByRole('switch', { name: en.hearth_divider_line }));
		expect(screen.getByLabelText(en.hearth_summary_text_optional)).toBeTruthy();
		expect(last().fields).toMatchObject({ collapsed: true, summary: 'Lights' });
	});

	it('reports only its own keys, so the sheet keeps YAML-only ones', () => {
		const { last } = setup({ entity: 'light.desk', extra: 'kept' });
		expect(Object.keys(last().fields)).not.toContain('extra');
		// what the edit sheets do with a draft
		const saved = { ...{ entity: 'light.desk', extra: 'kept' }, ...last().fields };
		expect(saved.extra).toBe('kept');
	});

	it('labels each control and describes it with its hint', () => {
		setup();
		const input = screen.getByLabelText(en.hearth_title);
		const hint = screen.getByText(en.hearth_math_hint);
		expect(input.getAttribute('aria-describedby')).toBe(hint.id);
		const entity = screen.getByLabelText(en.entity);
		expect(entity.getAttribute('aria-required')).toBe('true');
	});

	it('reads a stored value through read and stores it through write', () => {
		const { last } = setup({ title: 'x' }, [
			{
				key: 'title',
				kind: 'check',
				label: 'hearth_divider_line',
				read: (item) => item?.title === 'x',
				write: (on) => (on ? 'x' : 'y')
			}
		]);
		expect(
			screen.getByRole('switch', { name: en.hearth_divider_line }).getAttribute('aria-checked')
		).toBe('true');
		expect(last().fields.title).toBe('x');
	});
});

describe('CodeField compact', () => {
	it('marks a compact field, so it starts at three lines instead of the full height', () => {
		const { container } = render(CodeField, { label: 'x', compact: true });
		expect(container.querySelector('.code-field.compact')).not.toBeNull();
	});
});
