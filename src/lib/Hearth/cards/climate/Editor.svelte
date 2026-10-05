<script lang="ts">
	import type { CardEditorProps } from '../types';
	import type { ClimateCard } from './descriptor';
	import FormRenderer from '../../edit/FormRenderer.svelte';
	import { EditorForm } from '../../edit/form.svelte';

	let { initial, onchange }: CardEditorProps<ClimateCard> = $props();

	// remounted per target and type, so the initial value is all the form needs
	// svelte-ignore state_referenced_locally
	const form = new EditorForm(initial, [
		{ key: 'title', kind: 'text', label: 'hearth_title', example: 'hearth_example_climate_title' },
		{ key: 'entity', kind: 'entity', required: true, domains: ['climate'] }
	]);
</script>

<FormRenderer {form} {onchange} />
