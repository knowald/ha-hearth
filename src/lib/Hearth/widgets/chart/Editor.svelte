<script lang="ts">
	import type { WidgetEditorProps } from '../types';
	import type { ChartWidget } from './descriptor';
	import FormRenderer from '../../edit/FormRenderer.svelte';
	import { EditorForm } from '../../edit/form.svelte';

	let { initial, onchange }: WidgetEditorProps<ChartWidget> = $props();

	// remounted per target and type, so the initial value is all the form needs
	// svelte-ignore state_referenced_locally
	const form = new EditorForm(initial, [
		{ key: 'entity', kind: 'entity', required: true },
		{ key: 'name', kind: 'text', label: 'hearth_name_optional' },
		{
			key: 'style',
			kind: 'select',
			label: 'hearth_chart_style',
			default: 'line',
			options: [
				{ value: 'line', label: 'hearth_chart_line' },
				{ value: 'history', label: 'hearth_chart_history' },
				{ value: 'bar', label: 'hearth_chart_bar' },
				{ value: 'radial', label: 'hearth_chart_radial' }
			]
		},
		{
			key: 'period',
			kind: 'select',
			label: 'hearth_period',
			default: 'day',
			options: [
				{ value: 'hour', label: 'hearth_last_hour' },
				{ value: 'day', label: 'hearth_last_day' },
				{ value: 'week', label: 'hearth_last_week' },
				{ value: 'month', label: 'hearth_last_month' }
			],
			show: (values) => values.style === 'line' || values.style === 'history'
		},
		{
			key: 'math',
			kind: 'text',
			label: 'hearth_math',
			placeholder: 'x / 1000',
			hint: 'hearth_math_hint',
			advanced: true,
			show: (values) => values.style !== 'history'
		},
		{
			key: 'stroke',
			kind: 'number',
			label: 'hearth_stroke_width',
			placeholder: (values) => (values.style === 'radial' ? '9' : '2'),
			inputmode: 'numeric',
			integer: true,
			min: 1,
			advanced: true,
			show: (values) => values.style === 'line' || values.style === 'radial'
		}
	]);
</script>

<FormRenderer {form} {onchange} />
