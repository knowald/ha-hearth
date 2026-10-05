<script lang="ts">
	import type { WidgetEditorProps } from '../types';
	import type { CalendarWidget } from './descriptor';
	import FormRenderer from '../../edit/FormRenderer.svelte';
	import { EditorForm } from '../../edit/form.svelte';
	import { numberFromInput } from '../../edit/numbers';

	let { initial, onchange }: WidgetEditorProps<CalendarWidget> = $props();

	// remounted per target and type, so the initial value is all the form needs
	// svelte-ignore state_referenced_locally
	const form = new EditorForm(initial, [
		{
			key: 'entities',
			kind: 'list',
			label: 'hearth_calendar_entities_comma_separated',
			required: true,
			reason: 'hearth_calendar_entities_required',
			placeholder: 'calendar.family, calendar.work'
		},
		{
			key: 'travel_entity',
			kind: 'entity',
			label: 'hearth_travel_time_entity_minutes_optional',
			domains: ['sensor']
		},
		{
			key: 'lookahead_hours',
			kind: 'number',
			label: 'hearth_look_ahead_hours_default_24',
			placeholder: '24',
			inputmode: 'decimal',
			advanced: true,
			write: (raw) => {
				const hours = numberFromInput(String(raw));
				return Number.isFinite(hours) && hours > 0 ? hours : undefined;
			}
		}
	]);
</script>

<FormRenderer {form} {onchange} />
