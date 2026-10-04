<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import type { CardEditorProps } from '../types';
	import type { IframeCard } from './descriptor';
	import TextField from '../../edit/TextField.svelte';
	import { normalizeEmbedUrl } from '../../normalizers';
	import { requireFields } from '../../edit/validation';

	let { initial: initialProp, onchange }: CardEditorProps<IframeCard> = $props();

	// remounted per target and type, so the initial value is all the form needs
	// svelte-ignore state_referenced_locally
	const initial = initialProp;

	let title = $state(initial?.title ?? '');
	let url = $state(initial?.url ?? '');

	let urlValid = $derived(!url.trim() || normalizeEmbedUrl(url) !== undefined);
	// a malformed address explains itself under the field
	let validity = $derived(
		urlValid
			? requireFields($lang('hearth_field_required'), { label: $lang('hearth_url'), value: url })
			: { valid: false }
	);

	$effect(() => {
		onchange({
			fields: {
				title: title.trim() || undefined,
				url: normalizeEmbedUrl(url)
			},
			...validity
		});
	});
</script>

<TextField
	label={$lang('hearth_title')}
	bind:value={title}
	placeholder={$lang('hearth_example_web_page_title')}
/>
<TextField
	label={$lang('hearth_url')}
	required
	bind:value={url}
	placeholder="https://"
	error={urlValid ? undefined : $lang('hearth_embed_url_hint')}
/>
