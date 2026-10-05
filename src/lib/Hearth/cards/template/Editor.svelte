<script lang="ts">
	import type { CardEditorProps } from '../types';
	import type { TemplateCard } from './descriptor';
	import FormRenderer from '../../edit/FormRenderer.svelte';
	import { EditorForm } from '../../edit/form.svelte';

	let { initial, onchange }: CardEditorProps<TemplateCard> = $props();

	// remounted per target and type, so the initial value is all the form needs
	// svelte-ignore state_referenced_locally
	const form = new EditorForm(initial, [
		{ key: 'title', kind: 'text', label: 'hearth_title', example: 'hearth_example_template_title' },
		{ key: 'icon', kind: 'icon', label: 'hearth_icon_optional' },
		{
			key: 'content',
			kind: 'code',
			label: 'hearth_template',
			required: true,
			language: 'jinja2',
			expectMapping: false,
			placeholder: "**{{ states('sensor.outdoor') }}** outside",
			hint: 'hearth_template_hint'
		}
	]);
</script>

<FormRenderer {form} {onchange} />
