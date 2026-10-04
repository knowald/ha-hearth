<script lang="ts">
	import type { WidgetEditorProps } from '../types';
	import type { TemplateWidget } from './descriptor';
	import FormRenderer from '../../edit/FormRenderer.svelte';
	import { EditorForm } from '../../edit/form.svelte';

	let { initial, onchange }: WidgetEditorProps<TemplateWidget> = $props();

	// remounted per target and type, so the initial value is all the form needs
	// svelte-ignore state_referenced_locally
	const form = new EditorForm(initial, [
		{
			key: 'template',
			kind: 'code',
			label: 'hearth_template',
			required: true,
			language: 'jinja2',
			placeholder: "{{ states('sensor.outdoor') }} outside",
			hint: 'hearth_template_hint'
		}
	]);
</script>

<FormRenderer {form} {onchange} />
