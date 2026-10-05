<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import type { WidgetEditorProps } from '../types';
	import type { StatusWidget } from './descriptor';
	import ActionField from '../../edit/ActionField.svelte';
	import FormRenderer from '../../edit/FormRenderer.svelte';
	import { EditorForm } from '../../edit/form.svelte';

	let { initial: initialProp, onchange }: WidgetEditorProps<StatusWidget> = $props();

	// remounted per target and type, so the initial value is all the form needs
	// svelte-ignore state_referenced_locally
	const initial = initialProp;

	const form = new EditorForm(initial, [
		{ key: 'text', kind: 'text', example: 'hearth_example_status_text' },
		{ key: 'icon', kind: 'icon', placeholder: 'eco', beside: true },
		{
			key: 'entity',
			kind: 'entity',
			label: 'hearth_entity_optional_appends_its_state',
			hint: 'hearth_leave_text_and_entity_empty_to'
		}
	]);

	let tapAction = $state(initial?.tap_action);
	let holdAction = $state(initial?.hold_action);
	let tapValid = $state<boolean>();
	let holdValid = $state<boolean>();
	// without text or an entity the widget lists open problems and has no pill to tap
	let autoMode = $derived(!form.stored.text && !form.stored.entity);

	$effect(() => {
		onchange({
			fields: {
				...form.stored,
				tap_action: autoMode ? undefined : tapAction,
				hold_action: autoMode ? undefined : holdAction
			},
			valid: autoMode || (tapValid !== false && holdValid !== false)
		});
	});
</script>

<FormRenderer {form} />
{#if !autoMode}
	<ActionField label={$lang('hearth_tap_action')} bind:value={tapAction} bind:valid={tapValid} />
	<ActionField label={$lang('hearth_hold_action')} bind:value={holdAction} bind:valid={holdValid} />
{/if}
