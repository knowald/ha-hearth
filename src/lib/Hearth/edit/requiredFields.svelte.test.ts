import { render, screen } from '@testing-library/svelte';
import type { Component } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../../static/translations/en.json';
import CameraEditor from '../cards/camera/Editor.svelte';
import ClimateEditor from '../cards/climate/Editor.svelte';
import DaysSinceEditor from '../cards/days_since/Editor.svelte';
import IframeCardEditor from '../cards/iframe/Editor.svelte';
import ImageEditor from '../cards/image/Editor.svelte';
import MediaEditor from '../cards/media/Editor.svelte';
import TemperatureEditor from '../cards/temperature/Editor.svelte';
import VacuumEditor from '../cards/vacuum/Editor.svelte';
import CalendarEditor from '../widgets/calendar/Editor.svelte';
import ChartEditor from '../widgets/chart/Editor.svelte';
import EnergyEditor from '../widgets/energy/Editor.svelte';
import EntityWidgetEditor from '../widgets/entity/Editor.svelte';
import IframeWidgetEditor from '../widgets/iframe/Editor.svelte';
import ProgressEditor from '../widgets/progress/Editor.svelte';
import TemplateEditor from '../widgets/template/Editor.svelte';
import TimerEditor from '../widgets/timer/Editor.svelte';
import WeatherEditor from '../widgets/weather/Editor.svelte';
import { CARD_TYPES } from '../cards';
import { RAIL_WIDGET_TYPES } from '../widgets';

const required = (label: string) => en.hearth_field_required.replace('{field}', label);

/*
 * Every type that renders nothing useful without one field: an editor for it
 * must block Done until the field is filled, and name the field as the reason.
 */
const EDITORS: [type: string, editor: unknown, label: string, filled: Record<string, unknown>][] = [
	['climate', ClimateEditor, en.entity, { entity: 'climate.living' }],
	['camera', CameraEditor, en.entity, { entity: 'camera.door' }],
	['days_since', DaysSinceEditor, en.entity, { entity: 'input_datetime.filter' }],
	['image', ImageEditor, en.entity, { entity: 'image.floorplan' }],
	['media', MediaEditor, en.entity, { entity: 'media_player.living' }],
	['temperature', TemperatureEditor, en.entity, { entity: 'sensor.temperature' }],
	['vacuum', VacuumEditor, en.entity, { entity: 'vacuum.robot' }],
	['iframe card', IframeCardEditor, en.hearth_url, { url: 'https://example.com' }],
	['chart', ChartEditor, en.entity, { entity: 'sensor.power' }],
	[
		'energy',
		EnergyEditor,
		en.hearth_energy_sensor_today_total_or_increasing,
		{ entity: 'sensor.energy' }
	],
	['entity', EntityWidgetEditor, en.entity, { entity: 'light.desk' }],
	['progress', ProgressEditor, en.hearth_status_entity, { status_entity: 'sensor.printer' }],
	['weather', WeatherEditor, en.hearth_weather_entity, { entity: 'weather.home' }],
	['timer', TimerEditor, en.entity, { entity: 'timer.laundry' }],
	[
		'calendar',
		CalendarEditor,
		en.hearth_calendar_entities_comma_separated,
		{ entities: ['calendar.family'] }
	],
	['template', TemplateEditor, en.hearth_template, { template: '{{ 1 }}' }],
	['iframe widget', IframeWidgetEditor, en.hearth_url, { url: 'https://example.com' }]
];

// reasons that would read badly built from the field's long label
const SHORT_REASONS: Record<string, string> = {
	energy: required(en.hearth_energy_sensor),
	calendar: en.hearth_calendar_entities_required
};

function lastDraft(editor: unknown, initial?: Record<string, unknown>) {
	const onchange = vi.fn();
	render(editor as Component<{ initial: unknown; onchange: typeof onchange }>, {
		initial,
		onchange
	});
	return onchange.mock.lastCall?.[0] as { valid?: boolean; reason?: string };
}

describe.each(EDITORS)('%s editor', (_type, editor, label, filled) => {
	it('blocks Done while the required field is empty and names it', () => {
		expect(lastDraft(editor)).toMatchObject({
			valid: false,
			reason: SHORT_REASONS[_type] ?? required(label)
		});
	});

	it('lets Done through once the field is filled', () => {
		expect(lastDraft(editor, { id: 'x', ...filled }).valid).toBe(true);
	});

	it('marks the field as required', () => {
		lastDraft(editor);
		const marked = document.querySelectorAll('.field-required');
		expect(marked).toHaveLength(1);
		expect(marked[0].textContent).toBe(label);
	});
});

it('judges the calendar list once parsed, so commas alone do not count', () => {
	expect(lastDraft(CalendarEditor, { id: 'x', entities: [' ', ''] })).toMatchObject({
		valid: false,
		reason: en.hearth_calendar_entities_required
	});
});

describe('types without a required field', () => {
	// guards the table: a type that cannot render unconfigured should be in it
	it('are list or layout types the dashboard can show empty', () => {
		const listed = new Set(['entities', 'scenes', 'conditional_media', 'header']);
		const covered = new Set(EDITORS.map(([type]) => type.replace(/ (card|widget)$/, '')));
		const cards = CARD_TYPES.map((kind) => kind.type).filter(
			(type) => !covered.has(type) && !listed.has(type)
		);
		expect(cards).toEqual([]);
		const widgets = RAIL_WIDGET_TYPES.map((kind) => kind.type).filter(
			(type) =>
				!covered.has(type) &&
				!['clock', 'nav', 'search', 'spacer', 'label', 'status', 'notifications'].includes(type)
		);
		expect(widgets).toEqual([]);
	});

	it('leaves a malformed iframe address to its own error and the generic reason', () => {
		const draft = lastDraft(IframeCardEditor, { id: 'x', url: 'not a url' });
		expect(draft).toEqual(expect.objectContaining({ valid: false }));
		expect(draft.reason).toBeUndefined();
		expect(screen.getByRole('alert').textContent).toBe(en.hearth_embed_url_hint);
	});
});
