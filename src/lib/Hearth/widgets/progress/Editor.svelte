<script lang="ts">
	import type { WidgetEditorProps } from '../types';
	import type { ProgressWidget } from './descriptor';
	import FormRenderer from '../../edit/FormRenderer.svelte';
	import { EditorForm } from '../../edit/form.svelte';

	let { initial, onchange }: WidgetEditorProps<ProgressWidget> = $props();

	// remounted per target and type, so the initial value is all the form needs
	// svelte-ignore state_referenced_locally
	const form = new EditorForm(initial, [
		{ key: 'name', kind: 'text', example: 'hearth_example_progress_name' },
		{ key: 'icon', kind: 'icon', placeholder: 'local_laundry_service', beside: true },
		{ key: 'status_entity', kind: 'entity', label: 'hearth_status_entity', required: true },
		{ key: 'progress_entity', kind: 'entity', label: 'hearth_progress_entity_0_100_optional' },
		{
			key: 'unit',
			kind: 'text',
			label: 'hearth_progress_unit_optional_shows_the_value',
			placeholder: '%'
		},
		{
			key: 'remaining_entity',
			kind: 'entity',
			label: 'hearth_remaining_time_entity_minutes_or_timestamp'
		},
		{
			key: 'active_states',
			kind: 'list',
			label: 'hearth_active_states_comma_separated_optional',
			placeholder: 'running, rinse, spin',
			advanced: true
		},
		{
			key: 'completed_states',
			kind: 'list',
			label: 'hearth_completed_states_comma_separated',
			placeholder: 'complete, completed, finished, done',
			default: 'complete, completed, finished, done', // copy ok: state names
			advanced: true
		},
		{
			key: 'completion_delay_minutes',
			kind: 'select',
			label: 'hearth_after_completion',
			hint: 'hearth_completed_rows_can_be_tapped_to',
			default: '15',
			options: [
				{ value: '0', label: 'hearth_hide_immediately' },
				{ value: '5', label: 'hearth_hide_after_minutes', params: { minutes: '5' } },
				{ value: '15', label: 'hearth_hide_after_minutes', params: { minutes: '15' } },
				{ value: '30', label: 'hearth_hide_after_minutes', params: { minutes: '30' } },
				{ value: '60', label: 'hearth_hide_after_1_hour' },
				{ value: '-1', label: 'hearth_keep_until_tapped' }
			],
			// stored even at the default, as it always has been
			write: (raw) => Number(raw)
		}
	]);
</script>

<FormRenderer {form} {onchange} />
