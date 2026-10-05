<script lang="ts">
	import type { CardEditorProps } from '../types';
	import type { TemperatureCard } from './descriptor';
	import FormRenderer from '../../edit/FormRenderer.svelte';
	import { EditorForm } from '../../edit/form.svelte';

	let { initial, onchange }: CardEditorProps<TemperatureCard> = $props();

	// remounted per target and type, so the initial value is all the form needs
	// svelte-ignore state_referenced_locally
	const form = new EditorForm(initial, [
		{
			key: 'label',
			kind: 'text',
			label: 'hearth_label',
			example: 'hearth_example_temperature_label'
		},
		{ key: 'entity', kind: 'entity', required: true, domains: ['sensor'] },
		{ key: 'unit', kind: 'text', label: 'hearth_unit', default: '°C', placeholder: '°C' },
		{
			key: 'climate_entity',
			kind: 'entity',
			label: 'hearth_thermostat_optional',
			domains: ['climate'],
			hint: 'hearth_adds_a_target_readout_with_controls'
		},
		{
			key: 'verdict',
			kind: 'check',
			label: 'hearth_verdict_pill_for_air_sensors_good',
			hint: 'hearth_judged_by_device_class_custom_thresholds',
			read: (item) => item?.verdict !== false,
			// custom verdict bands have no form fields; a YAML-authored object
			// survives form edits as long as the verdict stays enabled
			write: (on, _values, item) =>
				on ? (typeof item?.verdict === 'object' ? item.verdict : undefined) : false
		}
	]);
</script>

<FormRenderer {form} {onchange} />
