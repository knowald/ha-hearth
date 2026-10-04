<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import type { CardEditorProps } from '../types';
	import type { TodoCard } from './descriptor';
	import CheckField from '../../edit/CheckField.svelte';
	import EntityField from '../../edit/EntityField.svelte';
	import SelectField from '../../edit/SelectField.svelte';
	import TextField from '../../edit/TextField.svelte';
	import { requireFields } from '../../edit/validation';

	let { initial: initialProp, onchange }: CardEditorProps<TodoCard> = $props();

	// remounted per target and type, so the initial value is all the form needs
	// svelte-ignore state_referenced_locally
	const initial = initialProp;

	let title = $state(initial?.title ?? '');
	let entity = $state(initial?.entity ?? '');
	let showCompleted = $state(initial?.show_completed ?? false);
	let sort = $state<string>(initial?.sort ?? 'manual');
	let hideAdd = $state(initial?.hide_add ?? false);

	let validity = $derived(
		requireFields($lang('hearth_field_required'), {
			label: $lang('entity'),
			value: entity
		})
	);

	$effect(() => {
		onchange({
			fields: {
				title: title.trim() || undefined,
				entity: entity.trim() || undefined,
				show_completed: showCompleted || undefined,
				sort: sort === 'alphabetical' || sort === 'due' ? sort : undefined,
				hide_add: hideAdd || undefined
			},
			...validity
		});
	});
</script>

<TextField
	label={$lang('hearth_title')}
	bind:value={title}
	placeholder={$lang('hearth_example_todo_title')}
/>
<EntityField label={$lang('entity')} required bind:value={entity} domains={['todo']} />
<SelectField
	label={$lang('hearth_todo_sort')}
	bind:value={sort}
	options={[
		{ value: 'manual', label: $lang('hearth_todo_sort_manual') },
		{ value: 'alphabetical', label: $lang('hearth_todo_sort_alphabetical') },
		{ value: 'due', label: $lang('hearth_todo_sort_due') }
	]}
/>
<CheckField
	label={$lang('hearth_todo_show_completed')}
	hint={$lang('hearth_todo_show_completed_hint')}
	bind:checked={showCompleted}
/>
<CheckField label={$lang('hearth_todo_hide_add')} bind:checked={hideAdd} />
