<script lang="ts">
	import type { WidgetEditorProps } from '../types';
	import type { WeatherWidget } from './descriptor';
	import FormRenderer from '../../edit/FormRenderer.svelte';
	import { EditorForm } from '../../edit/form.svelte';

	let { initial, onchange }: WidgetEditorProps<WeatherWidget> = $props();

	// remounted per target and type, so the initial value is all the form needs
	// svelte-ignore state_referenced_locally
	const form = new EditorForm(initial, [
		{
			key: 'entity',
			kind: 'entity',
			label: 'hearth_weather_entity',
			required: true,
			domains: ['weather']
		}
	]);
</script>

<FormRenderer {form} {onchange} />
