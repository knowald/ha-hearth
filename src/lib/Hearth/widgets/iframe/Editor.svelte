<script lang="ts">
	import type { WidgetEditorProps } from '../types';
	import type { IframeWidget } from './descriptor';
	import FormRenderer from '../../edit/FormRenderer.svelte';
	import { EditorForm } from '../../edit/form.svelte';
	import { normalizeEmbedUrl } from '../../normalizers';

	let { initial, onchange }: WidgetEditorProps<IframeWidget> = $props();

	// remounted per target and type, so the initial value is all the form needs
	// svelte-ignore state_referenced_locally
	const form = new EditorForm(initial, [
		{
			key: 'url',
			kind: 'text',
			label: 'hearth_url',
			required: true,
			placeholder: 'https://',
			write: (raw) => normalizeEmbedUrl(String(raw)),
			invalid: 'hearth_embed_url_hint'
		},
		{
			key: 'height',
			kind: 'number',
			label: 'hearth_height_px',
			placeholder: '150',
			inputmode: 'numeric',
			integer: true,
			min: 40
		}
	]);
</script>

<FormRenderer {form} {onchange} />
