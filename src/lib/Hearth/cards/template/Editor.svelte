<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import type { CardEditorProps } from '../types';
	import type { TemplateCard } from './descriptor';
	import CodeField from '../../edit/CodeField.svelte';
	import IconField from '../../edit/IconField.svelte';
	import TextField from '../../edit/TextField.svelte';
	import { requireFields } from '../../edit/validation';

	let { initial: initialProp, onchange }: CardEditorProps<TemplateCard> = $props();

	// remounted per target and type, so the initial value is all the form needs
	// svelte-ignore state_referenced_locally
	const initial = initialProp;

	let title = $state(initial?.title ?? '');
	let icon = $state(initial?.icon ?? '');
	let content = $state(initial?.content ?? '');

	let validity = $derived(
		requireFields($lang('hearth_field_required'), {
			label: $lang('hearth_template'),
			value: content
		})
	);

	$effect(() => {
		onchange({
			fields: {
				title: title.trim() || undefined,
				icon: icon.trim() || undefined,
				content: content.trim() ? content : undefined,
				// YAML-only hint list; carried so edits don't drop it
				entities: initial?.entities
			},
			...validity
		});
	});
</script>

<TextField
	label={$lang('hearth_title')}
	bind:value={title}
	placeholder={$lang('hearth_example_template_title')}
/>
<IconField label={$lang('hearth_icon_optional')} bind:value={icon} />
<CodeField
	label={$lang('hearth_template')}
	required
	language="jinja2"
	expectMapping={false}
	bind:value={content}
	placeholder={"**{{ states('sensor.outdoor') }}** outside"}
/>
<div class="hint">{$lang('hearth_template_hint')}</div>
