<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import type { WidgetEditorProps } from '../types';
	import type { StatusWidget } from './descriptor';
	import ActionField from '../../edit/ActionField.svelte';
	import EntityField from '../../edit/EntityField.svelte';
	import IconField from '../../edit/IconField.svelte';
	import TextField from '../../edit/TextField.svelte';

	let { initial: initialProp, onchange }: WidgetEditorProps<StatusWidget> = $props();

	// remounted per target and type, so the initial value is all the form needs
	// svelte-ignore state_referenced_locally
	const initial = initialProp;

	let text = $state(initial?.text ?? '');
	let icon = $state(initial?.icon ?? '');
	let entity = $state(initial?.entity ?? '');
	let tapAction = $state(initial?.tap_action);
	let holdAction = $state(initial?.hold_action);
	let tapValid = $state<boolean>();
	let holdValid = $state<boolean>();
	// without text or an entity the widget lists open problems and has no pill to tap
	let autoMode = $derived(!text.trim() && !entity.trim());

	$effect(() => {
		onchange({
			fields: {
				icon: icon.trim() || undefined,
				text: text.trim() || undefined,
				entity: entity.trim() || undefined,
				tap_action: autoMode ? undefined : tapAction,
				hold_action: autoMode ? undefined : holdAction
			},
			valid: autoMode || (tapValid !== false && holdValid !== false)
		});
	});
</script>

<div class="row">
	<div class="grow">
		<TextField
			label={$lang('text')}
			bind:value={text}
			placeholder={$lang('hearth_example_status_text')}
		/>
	</div>
	<div class="icon-column">
		<IconField label={$lang('icon')} bind:value={icon} placeholder="eco" />
	</div>
</div>
<EntityField label={$lang('hearth_entity_optional_appends_its_state')} bind:value={entity} />
<div class="hint">
	{$lang('hearth_leave_text_and_entity_empty_to')}
</div>
{#if !autoMode}
	<ActionField label={$lang('hearth_tap_action')} bind:value={tapAction} bind:valid={tapValid} />
	<ActionField label={$lang('hearth_hold_action')} bind:value={holdAction} bind:valid={holdValid} />
{/if}
