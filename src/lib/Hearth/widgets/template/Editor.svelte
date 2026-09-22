<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import type { WidgetEditorProps } from '../types';
	import type { TemplateWidget } from './descriptor';
	import CodeField from '../../edit/CodeField.svelte';

	let { initial: initialProp, onchange }: WidgetEditorProps<TemplateWidget> = $props();

	// remounted per target and type, so the initial value is all the form needs
	// svelte-ignore state_referenced_locally
	const initial = initialProp;

	let template = $state(initial?.template ?? '');

	$effect(() => {
		onchange({ fields: { template: template.trim() ? template : undefined } });
	});
</script>

<CodeField
	label={$lang('hearth_template')}
	language="jinja2"
	bind:value={template}
	placeholder={"{{ states('sensor.outdoor') }} outside"}
/>
<div class="hint">{$lang('hearth_template_hint')}</div>
