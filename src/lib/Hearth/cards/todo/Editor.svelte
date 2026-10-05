<script lang="ts">
	import type { CardEditorProps } from '../types';
	import type { TodoCard } from './descriptor';
	import FormRenderer from '../../edit/FormRenderer.svelte';
	import { EditorForm } from '../../edit/form.svelte';

	let { initial, onchange }: CardEditorProps<TodoCard> = $props();

	// remounted per target and type, so the initial value is all the form needs
	// svelte-ignore state_referenced_locally
	const form = new EditorForm(initial, [
		{ key: 'title', kind: 'text', label: 'hearth_title', example: 'hearth_example_todo_title' },
		{ key: 'entity', kind: 'entity', required: true, domains: ['todo'] },
		{
			key: 'sort',
			kind: 'select',
			label: 'hearth_todo_sort',
			default: 'manual',
			options: [
				{ value: 'manual', label: 'hearth_todo_sort_manual' },
				{ value: 'alphabetical', label: 'hearth_todo_sort_alphabetical' },
				{ value: 'due', label: 'hearth_todo_sort_due' }
			]
		},
		{
			key: 'show_completed',
			kind: 'check',
			label: 'hearth_todo_show_completed',
			hint: 'hearth_todo_show_completed_hint'
		},
		{ key: 'hide_add', kind: 'check', label: 'hearth_todo_hide_add' }
	]);
</script>

<FormRenderer {form} {onchange} />
