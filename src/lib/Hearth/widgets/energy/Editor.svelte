<script lang="ts">
	import type { WidgetEditorProps } from '../types';
	import type { EnergyWidget } from './descriptor';
	import FormRenderer from '../../edit/FormRenderer.svelte';
	import { EditorForm } from '../../edit/form.svelte';

	let { initial, onchange }: WidgetEditorProps<EnergyWidget> = $props();

	// remounted per target and type, so the initial value is all the form needs
	// svelte-ignore state_referenced_locally
	const form = new EditorForm(initial, [
		{
			key: 'entity',
			kind: 'entity',
			label: 'hearth_energy_sensor_today_total_or_increasing',
			required: true,
			shortLabel: 'hearth_energy_sensor',
			domains: ['sensor']
		},
		{
			key: 'price',
			kind: 'number',
			label: 'hearth_price_per_kwh_optional',
			placeholder: '0.72',
			inputmode: 'decimal'
		},
		{
			key: 'price_entity',
			kind: 'entity',
			label: 'hearth_price_entity_optional_overrides_static_price',
			domains: ['sensor', 'input_number']
		},
		{
			key: 'currency',
			kind: 'text',
			label: 'hearth_currency_label_optional',
			placeholder: 'zł'
		},
		{
			key: 'average_badge',
			kind: 'check',
			label: 'hearth_energy_average_badge',
			hint: 'hearth_energy_average_badge_hint',
			default: true
		}
	]);
</script>

<FormRenderer {form} {onchange} />
