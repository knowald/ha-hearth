<script lang="ts">
	import { validTimeZone } from '../../clock';
	import type { WidgetEditorProps } from '../types';
	import type { ClockWidget } from './descriptor';
	import FormRenderer from '../../edit/FormRenderer.svelte';
	import { EditorForm } from '../../edit/form.svelte';

	let { initial, onchange }: WidgetEditorProps<ClockWidget> = $props();

	// remounted per target and type, so the initial value is all the form needs
	// svelte-ignore state_referenced_locally
	const form = new EditorForm(initial, [
		{
			key: 'timezone',
			kind: 'text',
			label: 'hearth_time_zone',
			placeholder: 'Europe/Warsaw',
			write: (raw) => validTimeZone(String(raw)),
			invalid: 'hearth_use_an_iana_time_zone_such'
		},
		{
			key: 'hour_format',
			kind: 'select',
			label: 'hearth_hour_format',
			default: 'auto',
			options: [
				{ value: 'auto', label: 'hearth_locale_default' },
				{ value: '12', label: 'hearth_12_hour' },
				{ value: '24', label: 'hearth_24_hour' }
			]
		},
		{ key: 'show_seconds', kind: 'check', label: 'hearth_show_seconds' }
	]);
</script>

<FormRenderer {form} {onchange} />
