<script lang="ts">
	import type { CardEditorProps } from '../types';
	import type { ImageCard } from './descriptor';
	import FormRenderer from '../../edit/FormRenderer.svelte';
	import { EditorForm } from '../../edit/form.svelte';

	let { initial, onchange }: CardEditorProps<ImageCard> = $props();

	// remounted per target and type, so the initial value is all the form needs
	// svelte-ignore state_referenced_locally
	const form = new EditorForm(initial, [
		{ key: 'title', kind: 'text', label: 'hearth_title', example: 'hearth_example_image_title' },
		{ key: 'entity', kind: 'entity', required: true, domains: ['image'] }
	]);
</script>

<FormRenderer {form} {onchange} />
