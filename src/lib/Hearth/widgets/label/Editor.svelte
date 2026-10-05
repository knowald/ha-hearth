<script lang="ts">
	import type { WidgetEditorProps } from '../types';
	import type { LabelWidget } from './descriptor';
	import FormRenderer from '../../edit/FormRenderer.svelte';
	import { EditorForm } from '../../edit/form.svelte';

	let { initial, onchange }: WidgetEditorProps<LabelWidget> = $props();

	// remounted per target and type, so the initial value is all the form needs
	// svelte-ignore state_referenced_locally
	const form = new EditorForm(initial, [
		{ key: 'text', kind: 'text', example: 'hearth_example_label_text' },
		{ key: 'divider', kind: 'check', label: 'hearth_divider_line' }
	]);
</script>

<FormRenderer {form} {onchange} />
