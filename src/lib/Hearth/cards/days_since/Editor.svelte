<script lang="ts">
	import type { CardEditorProps } from '../types';
	import type { DaysSinceCard } from './descriptor';
	import FormRenderer from '../../edit/FormRenderer.svelte';
	import { EditorForm } from '../../edit/form.svelte';

	let { initial, onchange }: CardEditorProps<DaysSinceCard> = $props();

	// remounted per target and type, so the initial value is all the form needs
	// svelte-ignore state_referenced_locally
	const form = new EditorForm(initial, [
		{
			key: 'title',
			kind: 'text',
			label: 'hearth_title',
			example: 'hearth_example_days_since_title'
		},
		{
			key: 'entity',
			kind: 'entity',
			required: true,
			domains: ['input_datetime'],
			hint: 'hearth_days_since_entity_hint'
		},
		{ key: 'icon', kind: 'icon', label: 'hearth_icon_optional' }
	]);
</script>

<FormRenderer {form} {onchange} />
