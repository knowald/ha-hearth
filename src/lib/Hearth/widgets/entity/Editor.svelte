<script lang="ts">
	import type { WidgetEditorProps } from '../types';
	import type { EntityWidget } from './descriptor';
	import FormRenderer from '../../edit/FormRenderer.svelte';
	import { EditorForm } from '../../edit/form.svelte';

	let { initial, onchange }: WidgetEditorProps<EntityWidget> = $props();

	// remounted per target and type, so the initial value is all the form needs
	// svelte-ignore state_referenced_locally
	const form = new EditorForm(initial, [
		{ key: 'entity', kind: 'entity', required: true },
		{ key: 'name', kind: 'text', label: 'hearth_name_optional' },
		{ key: 'icon', kind: 'icon', label: 'hearth_icon_optional', beside: true },
		{
			key: 'vertical_padding',
			kind: 'select',
			label: 'hearth_vertical_padding',
			options: [
				{ value: '', label: 'hearth_standard_density' },
				{ value: 'compact', label: 'hearth_compact' }
			]
		}
	]);
</script>

<FormRenderer {form} {onchange} />
