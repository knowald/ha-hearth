<script lang="ts">
	import type { WidgetEditorProps } from '../types';
	import type { TimerWidget } from './descriptor';
	import FormRenderer from '../../edit/FormRenderer.svelte';
	import { EditorForm } from '../../edit/form.svelte';

	let { initial, onchange }: WidgetEditorProps<TimerWidget> = $props();

	// remounted per target and type, so the initial value is all the form needs
	// svelte-ignore state_referenced_locally
	const form = new EditorForm(initial, [
		{ key: 'entity', kind: 'entity', required: true, domains: ['timer'] },
		{ key: 'name', kind: 'text', label: 'hearth_name_optional' }
	]);
</script>

<FormRenderer {form} {onchange} />
