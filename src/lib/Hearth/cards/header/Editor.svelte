<script lang="ts">
	import type { CardEditorProps } from '../types';
	import type { HeaderCard } from './descriptor';
	import FormRenderer from '../../edit/FormRenderer.svelte';
	import { EditorForm } from '../../edit/form.svelte';

	let { initial, onchange }: CardEditorProps<HeaderCard> = $props();

	// remounted per target and type, so the initial value is all the form needs
	// svelte-ignore state_referenced_locally
	const form = new EditorForm(initial, [
		{ key: 'title', kind: 'text', label: 'hearth_title', example: 'hearth_example_header_title' },
		{
			key: 'subtitle',
			kind: 'text',
			label: 'hearth_subtitle',
			example: 'hearth_example_page_summary'
		},
		{ key: 'icon', kind: 'icon', default: 'home', placeholder: 'home' },
		{
			key: 'temp_entity',
			kind: 'entity',
			label: 'hearth_temperature_sensor_optional',
			domains: ['sensor']
		},
		{
			key: 'humidity_entity',
			kind: 'entity',
			label: 'hearth_humidity_sensor_optional',
			domains: ['sensor']
		},
		{ key: 'background_image', kind: 'image', label: 'hearth_background_image' }
	]);
</script>

<FormRenderer {form} {onchange} />
