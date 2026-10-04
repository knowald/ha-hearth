<script lang="ts">
	import type { WidgetEditorProps } from '../types';
	import { SPACER_MIN_HEIGHT, type SpacerWidget } from '../../model/widgets/spacer';
	import FormRenderer from '../../edit/FormRenderer.svelte';
	import { EditorForm } from '../../edit/form.svelte';

	let { initial, onchange }: WidgetEditorProps<SpacerWidget> = $props();

	// remounted per target and type, so the initial value is all the form needs
	// svelte-ignore state_referenced_locally
	const form = new EditorForm(initial, [
		{
			key: 'height',
			kind: 'number',
			label: 'hearth_height_px',
			placeholder: '24',
			inputmode: 'numeric',
			integer: true,
			min: SPACER_MIN_HEIGHT,
			hint: 'hearth_spacer_height_hint'
		},
		{ key: 'line', kind: 'check', label: 'hearth_divider_line' }
	]);
</script>

<FormRenderer {form} {onchange} />
