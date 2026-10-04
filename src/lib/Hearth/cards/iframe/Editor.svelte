<script lang="ts">
	import type { CardEditorProps } from '../types';
	import type { IframeCard } from './descriptor';
	import FormRenderer from '../../edit/FormRenderer.svelte';
	import { EditorForm } from '../../edit/form.svelte';
	import { normalizeEmbedUrl } from '../../normalizers';

	let { initial, onchange }: CardEditorProps<IframeCard> = $props();

	// remounted per target and type, so the initial value is all the form needs
	// svelte-ignore state_referenced_locally
	const form = new EditorForm(initial, [
		{ key: 'title', kind: 'text', label: 'hearth_title', example: 'hearth_example_web_page_title' },
		{
			key: 'url',
			kind: 'text',
			label: 'hearth_url',
			required: true,
			placeholder: 'https://',
			write: (raw) => normalizeEmbedUrl(String(raw)),
			invalid: 'hearth_embed_url_hint'
		}
	]);
</script>

<FormRenderer {form} {onchange} />
