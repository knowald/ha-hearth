<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import type { WidgetEditorProps } from '../types';
	import type { LabelWidget } from './descriptor';
	import CheckField from '../../edit/CheckField.svelte';
	import TextField from '../../edit/TextField.svelte';

	let { initial: initialProp, onchange }: WidgetEditorProps<LabelWidget> = $props();

	// remounted per target and type, so the initial value is all the form needs
	// svelte-ignore state_referenced_locally
	const initial = initialProp;

	let text = $state(initial?.text ?? '');
	let divider = $state(initial?.divider ?? false);

	$effect(() => {
		onchange({ fields: { text: text.trim() || undefined, divider: divider || undefined } });
	});
</script>

<TextField
	label={$lang('text')}
	bind:value={text}
	placeholder={$lang('hearth_example_label_text')}
/>
<CheckField label={$lang('hearth_divider_line')} bind:checked={divider} />
